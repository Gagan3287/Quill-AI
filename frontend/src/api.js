import axios from 'axios';

const API_URL = (window.env && window.env.API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Shared axios instance with timeout
const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minute timeout for large files
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  }
});

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
