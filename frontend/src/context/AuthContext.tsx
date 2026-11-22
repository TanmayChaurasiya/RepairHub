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
  role: 'CUSTOMER' | 'MECHANIC' | 'ADMIN' | 'GARAGE';
  mechanicProfile?: {
    id: string;
    garageId: string;
    skills: string[];
    available: boolean;
    availability?: 'AVAILABLE' | 'BUSY' | 'ON_BREAK' | 'OFFLINE';
    breakReason?: string | null;
    lastActiveAt?: string | null;
    rating: number;
    totalReviews: number;
    status?: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
    specialization?: string;
    experienceYears?: number;
    garage?: {
      id: string;
      name: string;
      city: string;
      isVerified: boolean;
    };
  };
  ownedGarage?: {
    id: string;
    name: string;
    city: string;
    address: string;
    phone: string;
    state?: string;
    pinCode?: string;
    description?: string;
    operatingHours?: string;
    services?: string[];
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    isVerified: boolean;
    rejectionReason?: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, expectedRole?: string) => Promise<User>;
  register: (data: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  setAuthData: (user: User, accessToken: string, refreshToken: string) => void;
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

  const login = async (email: string, password: string, expectedRole?: string): Promise<User> => {
    const payload: any = { email, password };
    if (expectedRole && expectedRole !== 'ALL') {
      payload.expectedRole = expectedRole;
    }
    const data = await api.post<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', payload);

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

  const setAuthData = (newUser: User, newAccessToken: string, newRefreshToken: string) => {
    localStorage.setItem('repairhub_token', newAccessToken);
    localStorage.setItem('repairhub_refresh_token', newRefreshToken);
    localStorage.setItem('repairhub_user', JSON.stringify(newUser));

    setToken(newAccessToken);
    setUser(newUser);
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
        setAuthData,
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
