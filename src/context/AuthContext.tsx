import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setToken, clearToken, getRole, setRole, clearRole } from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string;
  role: string;
  isAdmin: boolean;
  login: (user: string, pass: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (current: string, next: string) => Promise<boolean>;
  changeUsername: (newName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadSession() {
  const token = sessionStorage.getItem('tamales_token');
  const username = sessionStorage.getItem('tamales_username') ?? '';
  const role = getRole();
  return { authenticated: !!token, username, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = loadSession();
  const [isAuthenticated, setIsAuthenticated] = useState(session.authenticated);
  const [username, setUsername] = useState(session.username);
  const [role, setRoleState] = useState(session.role);

  const isAdmin = role === 'admin';

  async function login(user: string, pass: string): Promise<boolean> {
    try {
      const res = await api.login(user, pass);
      setToken(res.token);
      setRole(res.role);
      sessionStorage.setItem('tamales_username', res.username);
      setIsAuthenticated(true);
      setUsername(res.username);
      setRoleState(res.role);
      return true;
    } catch {
      return false;
    }
  }

  function logout() {
    clearToken();
    clearRole();
    sessionStorage.removeItem('tamales_username');
    setIsAuthenticated(false);
    setUsername('');
    setRoleState('admin');
  }

  async function changePassword(current: string, next: string): Promise<boolean> {
    try {
      await api.changePassword(current, next);
      return true;
    } catch {
      return false;
    }
  }

  async function changeUsername(newName: string): Promise<boolean> {
    try {
      const res = await api.changeUsername(newName);
      setToken(res.token);
      setRole(res.role);
      sessionStorage.setItem('tamales_username', res.username);
      setUsername(res.username);
      setRoleState(res.role);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, role, isAdmin, login, logout, changePassword, changeUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
