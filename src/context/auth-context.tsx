
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
const jwtDecode = require('jwt-decode');

interface AuthenticatedUser {
  email: string;
  given_name: string;
  family_name: string;
  nameid: string;
  picture?: string;
  [key: string]: any;
}

interface AuthResponse {
  isSuccess: boolean;
  accessToken?: string;
  refreshToken?: string;
  errors?: string[] | null;
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (data: any) => Promise<AuthResponse>;
  register: (data: any) => Promise<AuthResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_BASE_URL,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const setSession = useCallback((newAccessToken: string | null, newRefreshToken: string | null) => {
    if (newAccessToken && newRefreshToken) {
      try {
        const decodedUser = jwtDecode<AuthenticatedUser>(newAccessToken);
        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        setUser(decodedUser);
        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
      } catch (error) {
        console.error("Failed to decode token:", error);
        // Clear session if token is invalid
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        delete axiosInstance.defaults.headers.common['Authorization'];
      }
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    try {
      const storedAccessToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (storedAccessToken && storedRefreshToken) {
        setSession(storedAccessToken, storedRefreshToken);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to initialize auth session", error);
      setSession(null, null);
    }
  }, [setSession]);

  const handleAuthResponse = (response: AuthResponse) => {
    if (response.isSuccess && response.accessToken && response.refreshToken) {
      setSession(response.accessToken, response.refreshToken);
    }
    return response;
  }

  const login = async (data: any) => {
    setLoading(true);
    try {
      const response = await axiosInstance.post<AuthResponse>('/api/Auth/login', data);
      return handleAuthResponse(response.data);
    } catch (error) {
      const axiosError = error as AxiosError<AuthResponse>;
      setLoading(false);
      return axiosError.response?.data || { isSuccess: false, errors: ['An unknown error occurred'] };
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      const response = await axiosInstance.post<AuthResponse>('/api/Auth/register', data);
      return handleAuthResponse(response.data);
    } catch (error) {
       const axiosError = error as AxiosError<AuthResponse>;
       setLoading(false);
       return axiosError.response?.data || { isSuccess: false, errors: ['An unknown error occurred'] };
    }
  };

  const logout = useCallback(() => {
    setSession(null, null);
    router.push('/login');
  }, [setSession, router]);

  const value = {
    user,
    accessToken,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
