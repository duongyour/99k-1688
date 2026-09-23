import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isOwner: boolean;
  login: (email: string, password: string) => Promise<{ error?: string; user?: User }>;
  register: (data: { email: string; password: string; fullName: string; phone: string }) => Promise<{ error?: string; user?: User }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-Protection': '1'
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Clean up any stale localStorage token from previous legacy builds
  useEffect(() => {
    localStorage.removeItem('session_token');
  }, []);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Đăng nhập thất bại' };
      }
      setUser(data.user);
      return { user: data.user };
    } catch {
      return { error: 'Lỗi kết nối máy chủ' };
    }
  };

  const register = async (fields: { email: string; password: string; fullName: string; phone: string }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(fields)
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Đăng ký thất bại' };
      }
      setUser(data.user);
      return { user: data.user };
    } catch {
      return { error: 'Lỗi kết nối máy chủ' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
    } catch {
      // ignore
    }
    localStorage.removeItem('session_token');
    setUser(null);
  };

  const isOwner = user?.status === 'OWNER';

  return (
    <AuthContext.Provider value={{ user, loading, isOwner, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
