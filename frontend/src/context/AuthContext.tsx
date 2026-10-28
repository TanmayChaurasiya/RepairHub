'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'CUSTOMER' | 'MECHANIC' | 'ADMIN';
  mechanicProfile?: {
    id: string;
    garageId: string;
    skills: string[];
    available: boolean;
    rating: number;
    totalReviews: number;
    garage?: {
      id: string;
      name: string;
      city: string;
      isVerified: boolean;
    };
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const data = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
      localStorage.setItem('repairhub_user', JSON.stringify(data.user));
    } catch {
      logout();
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('repairhub_token');
    const storedUser = localStorage.getItem('repairhub_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        getSocket(); // Initialize socket connection with token
        // Validate session in background
        refreshUser().finally(() => setLoading(false));
      } catch {
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await api.post<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', { email, password });

    localStorage.setItem('repairhub_token', data.accessToken);
    localStorage.setItem('repairhub_refresh_token', data.refreshToken);
    localStorage.setItem('repairhub_user', JSON.stringify(data.user));

    setToken(data.accessToken);
    setUser(data.user);
    getSocket();

    return data.user;
  };

  const register = async (formData: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => {
    const data = await api.post<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', formData);

    localStorage.setItem('repairhub_token', data.accessToken);
    localStorage.setItem('repairhub_refresh_token', data.refreshToken);
    localStorage.setItem('repairhub_user', JSON.stringify(data.user));

    setToken(data.accessToken);
    setUser(data.user);
    getSocket();
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('repairhub_refresh_token');
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }

    localStorage.removeItem('repairhub_token');
    localStorage.removeItem('repairhub_refresh_token');
    localStorage.removeItem('repairhub_user');

    setUser(null);
    setToken(null);
    disconnectSocket();
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
