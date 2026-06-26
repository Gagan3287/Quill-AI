import axios from 'axios';

const getStoredApiUrl = () => {
  const stored = localStorage.getItem('API_URL');
  if (stored) return stored;
  
  const envUrl = (window.env && window.env.API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  return envUrl;
};

export const getApiUrl = () => getStoredApiUrl();

// Shared axios instance with timeout
export const api = axios.create({
  baseURL: getStoredApiUrl(),
  timeout: 120000, // 2 minute timeout for large files
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  }
});

// Function to dynamically update the API URL at runtime
export const updateApiUrl = (newUrl) => {
  let sanitizedUrl = newUrl.trim();
  if (sanitizedUrl && !sanitizedUrl.endsWith('/api') && !sanitizedUrl.endsWith('/api/')) {
    sanitizedUrl = sanitizedUrl.replace(/\/$/, '') + '/api';
  }
  localStorage.setItem('API_URL', sanitizedUrl);
  api.defaults.baseURL = sanitizedUrl;
  return sanitizedUrl;
};

// Automatically fetch the latest tunnel URL from Key-Value Store or GitHub if available
export const initializeApiUrl = async () => {
  // 1. Try Key-Value Store first (instant update, no Git/Vercel build delay)
  try {
    const res = await fetch('https://keyvalue.immanuel.co/api/KeyVal/GetValue/ndnbt2qd/tunnel_url');
    if (res.ok) {
      const base64 = await res.text();
      if (base64 && base64.trim() && base64.trim() !== '""' && base64.trim() !== 'null') {
        const cleanBase64 = base64.replace(/^"|"$/g, '').trim();
        const url = atob(cleanBase64);
        if (url && url.startsWith('http')) {
          const sanitizedUrl = updateApiUrl(url);
          console.log("Automatically resolved tunnel URL from Key-Value Store:", sanitizedUrl);
          return sanitizedUrl;
        }
      }
    }
  } catch (err) {
    console.warn("Could not fetch tunnel URL from Key-Value Store, checking GitHub fallback:", err);
  }

  // 2. Try GitHub raw file as fallback
  try {
    const res = await fetch(`https://raw.githubusercontent.com/Gagan3287/Quill-AI/main/tunnel.txt?t=${Date.now()}`);
    if (res.ok) {
      const url = await res.text();
      if (url && url.trim()) {
        const sanitizedUrl = updateApiUrl(url.trim());
        console.log("Automatically resolved tunnel URL from GitHub:", sanitizedUrl);
        return sanitizedUrl;
      }
    }
  } catch (err) {
    console.warn("Could not automatically fetch tunnel URL from GitHub, using local fallback:", err);
  }
  return getApiUrl();
};



export const uploadPdf = async (files) => {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const chatWithRag = async (query) => {
  const response = await api.post('/chat', { query });
  return response.data;
};

export const getDocuments = async () => {
  const response = await api.get('/documents');
  return response.data;
};

export const deleteDocument = async (filename) => {
  const response = await api.delete(`/documents/${encodeURIComponent(filename)}`);
  return response.data;
};
