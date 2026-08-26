import React from 'react';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { titleForRoute } from '@/lib/auth/route-permissions';

/**
 * Rendered outside the application shell: someone whose password change is
 * still pending must not reach the rest of the system, so there is nothing to
 * navigate to yet.
 */
export default async function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main className="flex min-h-screen flex-col items-center bg-muted/40 p-8 py-12">{children}</main>
  );
}

// Fills the "%s | NIB EPMO" template declared in the root layout, so this
// route's browser tab is distinguishable from every other one.
export const metadata = { title: titleForRoute('/change-password') };
