import axios from 'axios';

const TOKEN_KEY = 'mhmenu_token';

// Le stockage navigateur peut être indisponible (navigation privée, données bloquées) : on ne plante jamais.
export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignoré */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignoré */ }
  },
};

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || '';
    const isAuthForm = url.startsWith('/auth/login') || url.startsWith('/auth/register');
    if (error.response?.status === 401 && !isAuthForm) onUnauthorized();
    return Promise.reject(error);
  }
);

/** Normalise une erreur Axios : message lisible, code métier et erreurs par champ. */
export function parseError(error) {
  if (error.response) {
    const e = error.response.data?.error;
    return {
      status: error.response.status,
      code: e?.code,
      message: e?.message || 'Une erreur est survenue. Réessayez.',
      fields: e?.details && typeof e.details === 'object' ? e.details : {},
    };
  }
  if (error.code === 'ECONNABORTED') {
    return { status: 0, code: 'TIMEOUT', message: 'Le serveur met trop de temps à répondre. Réessayez.', fields: {} };
  }
  return { status: 0, code: 'NETWORK', message: 'Impossible de joindre le serveur. Vérifiez votre connexion.', fields: {} };
}
