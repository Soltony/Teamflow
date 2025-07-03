
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { syncUser } from '@/app/auth/actions';
import type { Role, User as PrismaUser } from '@prisma/client';
import { ALL_PERMISSIONS } from '@/lib/permissions';

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
  localUser: (PrismaUser & { roles: Role[] }) | null;
  accessToken: string | null;
  loading: boolean;
  isAdmin: boolean;
  permissions: Set<string>;
  hasPermission: (permission: string | string[]) => boolean;
  login: (data: any) => Promise<AuthResponse>;
  register: (data: any) => Promise<AuthResponse>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isUserAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_BASE_URL,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<(AuthenticatedUser & { nameid: string }) | null>(null);
  const [localUser, setLocalUser] = useState<(PrismaUser & { roles: Role[] }) | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const router = useRouter();

  const isUserAdmin = useCallback(() => {
    return localUser?.roles?.some(role => role.name === 'Admin') ?? false;
  }, [localUser]);

  const hasPermission = useCallback((permission: string) => {
    if (isUserAdmin()) {
        return true;
    }
    return userPermissions.has(permission);
  }, [userPermissions, isUserAdmin]);

  const setSession = useCallback(async (newAccessToken: string | null, newRefreshToken: string | null, authData?: any) => {
    setLoading(true);
    if (newAccessToken && newRefreshToken) {
      try {
        const decodedUser = jwtDecode<AuthenticatedUser>(newAccessToken);
        const userId = decodedUser.nameid || decodedUser.sub;
        
        if (!userId) {
          console.error("Failed to decode token: no user identifier (nameid or sub) found.");
          // Clear everything if the token is invalid
          localStorage.clear();
          setUser(null);
          setLocalUser(null);
          setAccessToken(null);
          setRefreshToken(null);
          setUserPermissions(new Set());
          delete axiosInstance.defaults.headers.common['Authorization'];
          setLoading(false);
          return;
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
        if (syncedUser) {
          setLocalUser(syncedUser);
          localStorage.setItem('localUser', JSON.stringify(syncedUser));
          
          const allPermissions = new Set<string>();
          syncedUser.roles?.forEach(role => {
              if (role.name === 'Admin') {
                ALL_PERMISSIONS.forEach(p => allPermissions.add(p));
              } else {
                role.permissions?.forEach(p => allPermissions.add(p));
              }
          });
          setUserPermissions(allPermissions);

        } else {
            // If sync fails, it might be a new user who needs to be created, or an error.
            // For now, let's clear local user data to avoid stale info.
            localStorage.removeItem('localUser');
            setLocalUser(null);
            setUserPermissions(new Set());
        }

      } catch (error) {
        console.error("Failed to decode token or sync user:", error);
        // Clear session if token is invalid
        localStorage.clear();
        setUser(null);
        setLocalUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        setUserPermissions(new Set());
        delete axiosInstance.defaults.headers.common['Authorization'];
      }
    } else {
      localStorage.clear();
      setUser(null);
      setLocalUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setUserPermissions(new Set());
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
            const parsedLocalUser = JSON.parse(storedLocalUser);
            setLocalUser(parsedLocalUser);
            const permissions = new Set<string>();
             parsedLocalUser.roles?.forEach((role: Role) => {
                if (role.name === 'Admin') {
                    ALL_PERMISSIONS.forEach(p => permissions.add(p));
                } else {
                    role.permissions?.forEach(p => permissions.add(p));
                }
            });
            setUserPermissions(permissions);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to initialize auth session from storage", error);
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
            const errorData = axiosError.response.data;
            const errorMessage = Array.isArray(errorData.errors) ? errorData.errors.join(', ') : (typeof errorData.errors === 'string' ? errorData.errors : 'An unexpected error occurred during registration.');
            return { isSuccess: false, errors: errorMessage };
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
    isAdmin,
    permissions,
    hasPermission,
    login,
    register,
    logout,
    hasPermission,
    isUserAdmin,
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
