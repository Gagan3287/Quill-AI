import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// API URL resolution
//
// Priority (highest → lowest):
//   1. localStorage override  — set at runtime via updateApiUrl() (dev convenience)
//   2. window.env.API_URL     — injected by generate-env.js at build/dev time
//   3. import.meta.env.VITE_API_URL — Vite env var (set in .env or Vercel dashboard)
//   4. localhost fallback     — local development default
// ─────────────────────────────────────────────────────────────────────────────
const resolveBaseUrl = () => {
  const stored = localStorage.getItem('API_URL');
  if (stored) return stored;

  // window.env is written by generate-env.js into public/env.js
  const windowEnv = window.env?.API_URL;
  if (windowEnv && windowEnv !== 'undefined') return windowEnv;

  return import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
};

export const getApiUrl = () => resolveBaseUrl();

/**
 * Override the API URL at runtime (stored in localStorage so it survives refresh).
 * Useful during local dev to point at a different backend without rebuilding.
 */
export const updateApiUrl = (newUrl) => {
  let url = newUrl.trim();
  if (url && !url.endsWith('/api') && !url.endsWith('/api/')) {
    url = url.replace(/\/$/, '') + '/api';
  }
  localStorage.setItem('API_URL', url);
  api.defaults.baseURL = url;
  return url;
};

// ─────────────────────────────────────────────────────────────────────────────
// Axios instance
// ─────────────────────────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 120_000, // 2 min — large file uploads can be slow
});

// ─────────────────────────────────────────────────────────────────────────────
// Retry interceptor
// Retries 502 / 503 / 504 (gateway / service unavailable / timeout) up to 2
// times with exponential backoff (1 s, then 2 s).  These are transient infra
// errors common on cold-start serverless backends.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Only retry on network errors or specific HTTP statuses
    const isRetryable =
      !error.response || RETRYABLE_STATUSES.has(error.response?.status);

    if (!isRetryable) return Promise.reject(error);

    config._retryCount = (config._retryCount || 0) + 1;
    if (config._retryCount > MAX_RETRIES) return Promise.reject(error);

    const delay = RETRY_DELAY_MS * config._retryCount;
    console.warn(
      `[api] Retrying request (attempt ${config._retryCount}/${MAX_RETRIES}) after ${delay}ms — ${error.message}`,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    return api(config);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────
export const uploadPdf = async (files) => {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
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
