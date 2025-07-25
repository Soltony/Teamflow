
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { syncUser } from '@/app/auth/actions';
import type { Role, User as PrismaUser } from '@prisma/client';
import { allPermissions as ALL_PERMISSIONS } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { useIdle } from 'react-use';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
  login: (data: any) => Promise<AuthResponse>;
  register: (data: any) => Promise<AuthResponse>;
  logout: () => void;
  hasPermission: (permission: string | string[]) => boolean;
  isUserAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_BASE_URL,
});

let isRefreshing = false;
let failedQueue: { resolve: (value: any) => void; reject: (reason?: any) => void; }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

function InactivityWarningDialog({ open, onConfirm, onIdle }: { open: boolean, onConfirm: () => void, onIdle: () => void }) {
    const [countdown, setCountdown] = useState(60);

    useEffect(() => {
        if (open) {
            setCountdown(60);
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        onIdle();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [open, onIdle]);

    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you still there?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You've been inactive for a while. You will be logged out in {countdown} seconds for security reasons.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={onConfirm}>Stay Logged In</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<(AuthenticatedUser & { nameid: string }) | null>(null);
  const [localUser, setLocalUser] = useState<(PrismaUser & { roles: Role[] }) | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { toast } = useToast();
  
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const isIdle = useIdle(14 * 60 * 1000, false); // 14 minutes

  const logout = useCallback(() => {
    setSession(null, null);
    router.replace('/login');
  }, [setSession, router]);

  useEffect(() => {
      if (isIdle && accessToken) {
          setShowIdleWarning(true);
      }
  }, [isIdle, accessToken]);

  const handleIdleConfirm = () => {
    setShowIdleWarning(false);
  };

  const handleIdleLogout = () => {
      setShowIdleWarning(false);
      logout();
      toast({
          title: "Session Timed Out",
          description: "You have been logged out due to inactivity.",
          variant: 'destructive',
      });
  };

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
          router.replace('/login');
          return;
        }

        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        setUser({ ...decodedUser, nameid: userId });
        setAccessToken(newAccessToken);
        setRefreshToken(newAccessToken);
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
            localStorage.removeItem('localUser');
            setLocalUser(null);
            setUserPermissions(new Set());
        }

      } catch (error) {
        console.error("Failed to decode token or sync user:", error);
        localStorage.clear();
        setUser(null);
        setLocalUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        setUserPermissions(new Set());
        delete axiosInstance.defaults.headers.common['Authorization'];
        router.replace('/login');
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
  }, [router]);

  
  useEffect(() => {
    const responseInterceptor = axiosInstance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            if (error.response?.status === 401 && !originalRequest._retry) {
                if (isRefreshing) {
                    return new Promise(function(resolve, reject) {
                        failedQueue.push({resolve, reject});
                    }).then(token => {
                        originalRequest.headers['Authorization'] = 'Bearer ' + token;
                        return axiosInstance(originalRequest);
                    }).catch(err => {
                        return Promise.reject(err);
                    });
                }
                
                originalRequest._retry = true;
                isRefreshing = true;

                const localRefreshToken = localStorage.getItem('refreshToken');
                if (!localRefreshToken) {
                    logout();
                    return Promise.reject(error);
                }

                try {
                  const { data } = await axios.post<AuthResponse>(`${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/refresh-token`, { refreshToken: localRefreshToken });
                  if (data.isSuccess && data.accessToken && data.refreshToken) {
                      await setSession(data.accessToken, data.refreshToken);
                      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
                      originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
                      processQueue(null, data.accessToken);
                      return axiosInstance(originalRequest);
                  } else {
                      // This path is hit if the refresh token is invalid or expired
                      throw new Error("Refresh token failed or expired");
                  }
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    logout();
                    toast({
                        title: 'Session Expired',
                        description: 'You have been logged out. Please sign in again.',
                        variant: 'destructive',
                    });
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }
            return Promise.reject(error);
        }
    );

    return () => {
        axiosInstance.interceptors.response.eject(responseInterceptor);
    };
  }, [logout, setSession, toast]);
  
  useEffect(() => {
    const initAuth = async () => {
        try {
            const storedAccessToken = localStorage.getItem('accessToken');
            const storedRefreshToken = localStorage.getItem('refreshToken');
            
            if (storedAccessToken && storedRefreshToken) {
                await setSession(storedAccessToken, storedRefreshToken);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Failed to initialize auth session from storage", error);
            await setSession(null, null);
        }
    };
    initAuth();
  }, [setSession]);
  
  const isUserAdmin = useCallback(() => {
    return localUser?.roles?.some(role => role.name === 'Admin') ?? false;
  }, [localUser]);

  const hasPermission = useCallback((permission: string | string[]) => {
    if (isUserAdmin()) {
        return true;
    }
    if (Array.isArray(permission)) {
      return permission.some(p => userPermissions.has(p));
    }
    return userPermissions.has(permission);
  }, [userPermissions, isUserAdmin]);

  const isAdmin = useMemo(() => isUserAdmin(), [isUserAdmin]);
  const permissions = useMemo(() => userPermissions, [userPermissions]);

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
          const errorData = axiosError.response.data;
          
          let errorMessage = 'Login failed. Please check your credentials and try again.'; // Default message
          
          if (errorData) {
            if (typeof errorData === 'string') {
              errorMessage = errorData;
            } else if (Array.isArray(errorData) && errorData.length > 0 && typeof errorData[0] === 'string') {
              errorMessage = errorData.join(', ');
            } else if (errorData.errors) {
              if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                  errorMessage = errorData.errors.join(', ');
              } else if (typeof errorData.errors === 'string') {
                  errorMessage = errorData.errors;
              }
            }
          }

          return { isSuccess: false, errors: [errorMessage] };
      }
      console.error("Client-side login request failed:", axiosError.message);
      return { isSuccess: false, errors: ['Could not connect to the authentication service.'] };
    } finally {
        setLoading(false);
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
            return { isSuccess: false, errors: [errorMessage] };
       }
       console.error("Client-side registration request failed:", axiosError.message);
       return { isSuccess: false, errors: ['Could not connect to the authentication service. Please check your network or contact support.'] };
    } finally {
        setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    localUser,
    accessToken,
    loading,
    isAdmin,
    permissions,
    login,
    register,
    logout,
    hasPermission,
    isUserAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
        {children}
        <InactivityWarningDialog 
            open={showIdleWarning}
            onConfirm={handleIdleConfirm}
            onIdle={handleIdleLogout}
        />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
