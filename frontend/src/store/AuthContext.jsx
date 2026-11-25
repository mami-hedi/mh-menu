import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, restaurant, subscription }
  const [loading, setLoading] = useState(() => !!tokenStore.get());

  const clear = useCallback(() => {
    tokenStore.clear();
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setSession(data);
    return data;
  }, []);

  // Au chargement : si un jeton existe, on récupère la session (sinon on est déconnecté)
  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!tokenStore.get()) return;
    let cancelled = false;
    refresh()
      .catch(() => { if (!cancelled) clear(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clear, refresh]);

  const acceptAuthResponse = useCallback((data) => {
    tokenStore.set(data.token);
    setSession({ user: data.user, restaurant: data.restaurant, subscription: data.subscription });
    return data;
  }, []);

  const login = useCallback(async (credentials) => acceptAuthResponse((await api.post('/auth/login', credentials)).data), [acceptAuthResponse]);
  const register = useCallback(async (payload) => acceptAuthResponse((await api.post('/auth/register', payload)).data), [acceptAuthResponse]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* la session locale est supprimée dans tous les cas */ }
    clear();
  }, [clear]);

  const value = useMemo(
    () => ({ ...session, isAuthenticated: !!session?.user, loading, login, register, logout, refresh }),
    [session, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}
