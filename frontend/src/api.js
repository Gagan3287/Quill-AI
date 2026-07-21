import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Session id
//
// Two modes:
//   - Signed-in users: a STABLE id of the form "user:<supabase_user_id>",
//     set via setAuthenticatedSessionId() right after login. This persists
//     across reloads, tab closes, and logins — the backend exempts "user:"
//     prefixed sessions from all auto-cleanup, so their documents survive.
//   - Guests: a random id per browser TAB (sessionStorage), unchanged from
//     before — cleared automatically on sign-out / tab-close / idle.
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_KEY = 'quill_session_id';

const generateGuestId = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getSessionId = () => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateGuestId();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

export let sessionId = getSessionId();

/**
 * Call this immediately after a successful sign-in with the Supabase user's
 * id. Switches every subsequent request onto a stable, non-cleaned-up
 * session so the signed-in user's documents and chat persist.
 */
export const setAuthenticatedSessionId = (supabaseUserId) => {
  sessionId = `user:${supabaseUserId}`;
  sessionStorage.setItem(SESSION_KEY, sessionId);
  api.defaults.headers['X-Session-Id'] = sessionId;
  return sessionId;
};

/**
 * Call this on sign-out to drop back to a fresh, ephemeral guest session —
 * so if the same browser continues as a guest, it doesn't inherit the
 * previous user's session id.
 */
export const resetToGuestSession = () => {
  sessionId = generateGuestId();
  sessionStorage.setItem(SESSION_KEY, sessionId);
  api.defaults.headers['X-Session-Id'] = sessionId;
  return sessionId;
};

// ─────────────────────────────────────────────────────────────────────────────
// API URL resolution
// ─────────────────────────────────────────────────────────────────────────────
const resolveBaseUrl = () => {
  const stored = localStorage.getItem('API_URL');
  // Guard against stale dev-only tunnel URLs (localtunnel, ngrok, etc.)
  // lingering in localStorage from earlier local testing. These are never
  // valid in production — if one is found, discard it automatically instead
  // of silently routing every request to a dead endpoint.
  const looksLikeDevTunnel = stored && /loca\.lt|ngrok|trycloudflare/i.test(stored);
  if (looksLikeDevTunnel) {
    console.warn(`[api] Ignoring stale dev-tunnel URL cached in localStorage: ${stored}`);
    localStorage.removeItem('API_URL');
  } else if (stored) {
    return stored;
  }

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
 * Wipe every document belonging to this session. Only meaningful for guests
 * — signed-in users' documents persist by design, so this is a no-op for
 * "user:" sessions (the backend also refuses this, but skip the network
 * call entirely rather than round-tripping to get rejected).
 */
export const clearSession = async () => {
  if (sessionId.startsWith('user:')) return { status: 'skipped', chunks_removed: 0 };
  const response = await api.delete('/session');
  return response.data;
};

/**
 * Best-effort cleanup for when the user just closes the tab instead of
 * clicking Sign Out (common for guests). sendBeacon fires even as the page
 * is unloading, where a normal axios/fetch call would get cancelled.
 * Skipped entirely for signed-in users — their documents should survive a
 * tab close, not just a clean sign-out.
 */
export const clearSessionOnUnload = () => {
  if (sessionId.startsWith('user:')) return;
  if (!navigator.sendBeacon) return;
  const url = `${resolveBaseUrl().replace(/\/$/, '')}/session/beacon-clear`;
  const blob = new Blob([JSON.stringify({ session_id: sessionId })], {
    type: 'application/json',
  });
  navigator.sendBeacon(url, blob);
};
