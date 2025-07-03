
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { syncUser } from '@/app/auth/actions';
import type { User as PrismaUser, Role } from '@prisma/client';

interface AuthenticatedUser {
  email: string;
  given_name: string;
  family_name: string;
  nameid?: string;
  sub?: string;
  picture?: string;
  [key: string]: any;
}

interface AuthResponse {
  isSuccess: boolean;
  accessToken?: string;
  refreshToken?: string;
  errors?: string[] | string | null;
}

type LocalUser = PrismaUser & { roles: Role[] };

interface AuthContextType {
  user: (AuthenticatedUser & { nameid: string }) | null;
  localUser: LocalUser | null;
  accessToken: string | null;
  loading: boolean;
  permissions: Set<string>;
  hasPermission: (permission: string | string[]) => boolean;
  login: (data: any) => Promise<AuthResponse>;
  register: (data: any) => Promise<AuthResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_BASE_URL,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<(AuthenticatedUser & { nameid: string }) | null>(null);
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(new Set<string>());
  const router = useRouter();
  
  const hasPermission = useCallback((requiredPermissions: string | string[]) => {
    if (loading) return false;
    if (typeof requiredPermissions === 'string') {
        return permissions.has(requiredPermissions);
    }
    return requiredPermissions.some(p => permissions.has(p));
  }, [permissions, loading]);

  const setSession = useCallback(async (newAccessToken: string | null, newRefreshToken: string | null, authData?: any) => {
    if (newAccessToken && newRefreshToken) {
      try {
        const decodedUser = jwtDecode<AuthenticatedUser>(newAccessToken);
        const userId = decodedUser.nameid || decodedUser.sub;
        
        if (!userId) {
          throw new Error("Failed to decode token: no user identifier (nameid or sub) found.");
        }

        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        setUser({ ...decodedUser, nameid: userId });
        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

        const syncInput = {
            id: userId,
            email: decodedUser.email,
            given_name: decodedUser.given_name,
            family_name: decodedUser.family_name,
            picture: decodedUser.picture,
            phoneNumber: authData?.phoneNumber,
        };

        const syncedUser = await syncUser(syncInput);
        setLocalUser(syncedUser as LocalUser);
        
        if (syncedUser) {
            localStorage.setItem('localUser', JSON.stringify(syncedUser));
            if (syncedUser.roles) {
              const userPermissions = new Set((syncedUser.roles as Role[]).flatMap(role => role.permissions));
              setPermissions(userPermissions);
            } else {
              setPermissions(new Set());
            }
        } else {
            localStorage.removeItem('localUser');
            setPermissions(new Set());
        }

      } catch (error) {
        console.error("Failed to decode token or sync user:", error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('localUser');
        setUser(null);
        setLocalUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        setPermissions(new Set());
        delete axiosInstance.defaults.headers.common['Authorization'];
      }
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('localUser');
      setUser(null);
      setLocalUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setPermissions(new Set());
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    try {
      const storedAccessToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const storedLocalUser = localStorage.getItem('localUser');
      if (storedAccessToken && storedRefreshToken) {
        setSession(storedAccessToken, storedRefreshToken);
        if (storedLocalUser) {
            const parsedUser = JSON.parse(storedLocalUser);
            setLocalUser(parsedUser);
            if (parsedUser.roles) {
              const userPermissions = new Set((parsedUser.roles as Role[]).flatMap(role => role.permissions));
              setPermissions(userPermissions);
            }
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to initialize auth session", error);
      setSession(null, null);
    }
  }, [setSession]);

  const handleAuthResponse = async (response: AuthResponse, authData?: any) => {
    if (response.isSuccess && response.accessToken && response.refreshToken) {
      await setSession(response.accessToken, response.refreshToken, authData);
    }
    return response;
  }

  const login = async (data: any) => {
    setLoading(true);
    try {
      const response = await axiosInstance.post<AuthResponse>('/api/Auth/login', data);
      return await handleAuthResponse(response.data, data);
    } catch (error) {
      const axiosError = error as AxiosError<AuthResponse>;
      setLoading(false);
      if (axiosError.response) {
          console.error("Auth service login failed on client. Response:", axiosError.response.data);
          return axiosError.response?.data;
      }
      console.error("Client-side login request failed:", axiosError.message);
      return { isSuccess: false, errors: ['Could not connect to the authentication service.'] };
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    const payload = { ...data, email: data.email || null };
    try {
      const response = await axiosInstance.post<AuthResponse>('/api/Auth/register', payload);
      return await handleAuthResponse(response.data, data);
    } catch (error) {
       const axiosError = error as AxiosError<AuthResponse>;
       setLoading(false);
       if (axiosError.response) {
            console.error("Auth service registration failed on client. Response:", axiosError.response.data);
            return axiosError.response.data;
       }
       console.error("Client-side registration request failed:", axiosError.message);
       // This could be a CORS issue or network error.
       return { isSuccess: false, errors: ['Could not connect to the authentication service. Please check your network or contact support.'] };
    }
  };

  const logout = useCallback(() => {
    setSession(null, null);
    router.push('/login');
  }, [setSession, router]);

  const value: AuthContextType = {
    user,
    localUser,
    accessToken,
    loading,
    permissions,
    hasPermission,
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
