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
