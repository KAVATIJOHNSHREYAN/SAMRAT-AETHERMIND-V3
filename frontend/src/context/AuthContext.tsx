/* eslint-disable */
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  token: string | null;
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (token: string, userId: string, email: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUserId = localStorage.getItem('user_id');
    const savedEmail = localStorage.getItem('user_email');

    if (savedToken && savedUserId) {
      setToken(savedToken);
      setUserId(savedUserId);
      setEmail(savedEmail);
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUserId: string, newEmail: string) => {
    setToken(newToken);
    setUserId(newUserId);
    setEmail(newEmail);

    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('user_id', newUserId);
    localStorage.setItem('user_email', newEmail);
    localStorage.setItem('aether_token', newToken);
    localStorage.setItem('aether_user', JSON.stringify({ email: newEmail, id: newUserId, subscription_status: 'free' }));
  };

  const logout = () => {
    setToken(null);
    setUserId(null);
    setEmail(null);

    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('aether_token');
    localStorage.removeItem('aether_user');
  };

  const value: AuthContextType = {
    token,
    userId,
    email,
    isAuthenticated: !!token,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

