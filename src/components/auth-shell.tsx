
'use client';

import { useAuth } from '@/context/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { AppShellProvider } from './app-shell';
import { NibLogo } from './logo';

const publicPaths = ['/login', '/register'];

function AuthLoadingScreen() {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <NibLogo className="w-12 h-12 animate-pulse" />
                <p className="text-muted-foreground">Loading your workspace...</p>
            </div>
        </div>
    );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { accessToken, loading, localUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!accessToken && !publicPaths.includes(pathname)) {
        router.replace('/login');
      } else if (accessToken && publicPaths.includes(pathname)) {
        router.replace('/dashboard');
      }
    }
  }, [loading, accessToken, router, pathname]);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!accessToken || !localUser) {
    if (publicPaths.includes(pathname)) {
      return <>{children}</>;
    }
    return <AuthLoadingScreen />;
  }

  if (publicPaths.includes(pathname)) {
    return <AuthLoadingScreen />;
  }

  return <AppShellProvider>{children}</AppShellProvider>;
}
