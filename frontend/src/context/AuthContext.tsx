// Context: Auth state management
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  apiLogin, apiRegister, apiLogout,
  loadUser, clearToken,
  type AuthUser,
} from '../api/client';
import { wsConnect, wsDisconnect } from '../ws';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login(username: string, password: string): Promise<void>;
  register(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  // Restore session from localStorage on mount.
  useEffect(() => {
    const saved = loadUser();
    if (saved) {
      setUser(saved);
      wsConnect();
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const resp = await apiLogin(username, password);
    setUser(resp);
    wsConnect();
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    await apiRegister(username, password);
    // Auto-login after registration.
    await login(username, password);
  }, [login]);

  const logout = useCallback(async () => {
    await apiLogout().catch(() => {});
    clearToken();
    wsDisconnect();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
