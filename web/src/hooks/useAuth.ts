import { useState, useEffect, useCallback } from 'react';
import { Atendente, LoginResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Atendente | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cn_token') : null;
    if (stored) {
      setToken(stored);
      fetchUser(stored);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (tk: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser({
          id: data.id,
          nome: data.email, // backend me returns id, email, role; no nome yet
          email: data.email,
          role: data.role,
          created_at: '',
        });
      } else {
        localStorage.removeItem('cn_token');
        setToken(null);
      }
    } catch {
      // offline or server down — keep token, no user
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data: LoginResponse = await res.json();
      localStorage.setItem('cn_token', data.token);
      setToken(data.token);
      setUser({
        id: data.user_id,
        nome: data.nome,
        email: data.email,
        role: data.role,
        created_at: '',
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('cn_token');
    setToken(null);
    setUser(null);
  }, []);

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  return { token, user, loading, login, logout, authHeaders, isAdmin: user?.role === 'admin' };
}
