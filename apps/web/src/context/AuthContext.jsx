import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService.js';
import { setAccessToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(({ user: u, accessToken }) => {
    setUser(u);
    setAccessToken(accessToken);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  // Silently restore session from the HttpOnly refresh-token cookie on mount
  useEffect(() => {
    authService.refresh()
      .then(applySession)
      .catch(clearSession)
      .finally(() => setLoading(false));
  }, [applySession, clearSession]);

  const login = useCallback(async credentials => {
    const session = await authService.login(credentials);
    applySession(session);
    return session.user;
  }, [applySession]);

  const register = useCallback(async data => {
    const session = await authService.register(data);
    applySession(session);
    return session.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    await authService.logout().catch(() => {});
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
