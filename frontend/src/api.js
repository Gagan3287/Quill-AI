import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Session id
//
// One random id per browser TAB, stored in sessionStorage (not localStorage) so
// it's automatically gone when the tab/window closes — nothing to "forget" to
// clean up client-side. Every upload/chat/documents request sends this as
// X-Session-Id so the backend can scope ChromaDB storage per-session instead
// of sharing one global bucket across every guest that's ever visited.
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_KEY = 'quill_session_id';

const getSessionId = () => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

export const sessionId = getSessionId();

// ─────────────────────────────────────────────────────────────────────────────
// API URL resolution
// ─────────────────────────────────────────────────────────────────────────────
const resolveBaseUrl = () => {
  const stored = localStorage.getItem('API_URL');
  if (stored) return stored;

  const windowEnv = window.env?.API_URL;
  if (windowEnv && windowEnv !== 'undefined') return windowEnv;

  return import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
};

export const getApiUrl = () => resolveBaseUrl();

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
  timeout: 120_000,
  headers: { 'X-Session-Id': sessionId },
});

// ─────────────────────────────────────────────────────────────────────────────
// Retry interceptor
// ─────────────────────────────────────────────────────────────────────────────
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
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

/**
 * Wipe every document belonging to this session. Call on explicit sign-out.
 */
export const clearSession = async () => {
  const response = await api.delete('/session');
  return response.data;
};

/**
 * Best-effort cleanup for when the user just closes the tab instead of
 * clicking Sign Out (common for guests). sendBeacon fires even as the page
 * is unloading, where a normal axios/fetch call would get cancelled.
 * Note: sendBeacon only supports POST, so the backend also needs a POST
 * alias for /api/session/beacon-clear if you want this path covered too —
 * see main.py. Falls back to silently doing nothing if unsupported.
 */
export const clearSessionOnUnload = () => {
  if (!navigator.sendBeacon) return;
  const url = `${resolveBaseUrl().replace(/\/$/, '')}/session/beacon-clear`;
  const blob = new Blob([JSON.stringify({ session_id: sessionId })], {
    type: 'application/json',
  });
  navigator.sendBeacon(url, blob);
};
