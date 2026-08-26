import React from 'react';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { titleForRoute } from '@/lib/auth/route-permissions';

/**
 * Sends genuinely signed-in visitors to the dashboard.
 *
 * This check lives here rather than in the middleware because it needs the
 * database: only by looking the session up can we tell a live one from an
 * expired, revoked or idled-out cookie. Deciding it in the middleware, which
 * sees nothing but the cookie's presence, is what previously trapped anyone
 * with a stale cookie in a /login <-> /dashboard redirect loop.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.mustChangePassword ? '/change-password' : '/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-muted/40 p-8 py-12">
      {children}
    </main>
  );
}

// Fills the "%s | NIB EPMO" template declared in the root layout, so this
// route's browser tab is distinguishable from every other one.
export const metadata = { title: titleForRoute('/login') };
