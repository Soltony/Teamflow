
"use client";

import { useAuth } from "@/context/auth-context";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { NibLogo } from "./logo";

const publicPaths = ["/login", "/register"];

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
      const forceChangePhoneNumber = localStorage.getItem('forcePasswordChange');
      if (forceChangePhoneNumber && localUser && localUser.phoneNumber === forceChangePhoneNumber) {
        if (pathname !== '/profile') {
          router.replace('/profile');
        }
        return;
      }

      if (!accessToken && !publicPaths.includes(pathname)) {
        router.replace("/login");
      } else if (accessToken && publicPaths.includes(pathname)) {
        router.replace("/dashboard");
      }
    }
  }, [loading, accessToken, router, pathname, localUser]);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  // If user is not authenticated and is on a public path, show the page.
  if (!accessToken && publicPaths.includes(pathname)) {
    return <>{children}</>;
  }
  
  // If user is not authenticated and tries to access a protected route, show loading while redirecting.
  if (!accessToken) {
    return <AuthLoadingScreen />;
  }
  
  // If user is authenticated and on a public path, show loading while redirecting.
  if (publicPaths.includes(pathname)) {
      return <AuthLoadingScreen />;
  }
  
  // If user is being forced to change password, only render the profile page
  const forceChangePhoneNumber = localStorage.getItem('forcePasswordChange');
  if (forceChangePhoneNumber && localUser && localUser.phoneNumber === forceChangePhoneNumber && pathname !== '/profile') {
      return <AuthLoadingScreen />;
  }
  
  // If authenticated and on a protected route, render the children (which will be wrapped in AppShell via layouts)
  return <>{children}</>;
}
