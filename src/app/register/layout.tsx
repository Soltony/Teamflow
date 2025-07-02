import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-muted/40 p-8 py-12">
      {children}
    </main>
  );
}
