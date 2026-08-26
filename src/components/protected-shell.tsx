import { redirect } from 'next/navigation';
import Link from 'next/link';

import { AppShellProvider } from '@/components/app-shell';
import { AuthProvider } from '@/context/auth-context';
import { getCurrentUserAction } from '@/app/auth/actions';
import { userHasPermission } from '@/lib/auth/guard';
import { getCurrentUser, sessionIdleMs } from '@/lib/auth/session';
import { permissionForRoute } from '@/lib/auth/route-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

/**
 * Server-side gate for every authenticated route.
 *
 * This is where route access is actually decided. The sidebar hides links the
 * user cannot use and the middleware bounces anonymous visitors, but both are
 * presentation: a route is only protected because this component checked the
 * session and the permission before rendering anything.
 *
 * Each route's layout renders this with the permission that route requires.
 */
export async function ProtectedShell({
  children,
  permission,
}: {
  children: React.ReactNode;
  /** Omit for routes any signed-in user may open, such as /profile. */
  permission?: string | string[];
}) {
  const user = await getCurrentUser();

  // A minute before the server would end the session, floored at 30 seconds
  // so a very short timeout still shows something rather than nothing.
  const idleWarningMs = Math.max(30_000, (await sessionIdleMs()) - 60_000);

  if (!user) redirect('/login');

  // A pending password change blocks everything else until it is done.
  if (user.mustChangePassword) redirect('/change-password');

  if (permission && !userHasPermission(user, permission)) {
    return (
      <AuthProvider initialUser={await getCurrentUserAction()} idleWarningMs={idleWarningMs}>
        <AppShellProvider>
          <div className="p-4 sm:p-6">
            <Card className="max-w-lg mx-auto mt-12">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <ShieldAlert className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>You do not have access to this page</CardTitle>
                <CardDescription>
                  Your role does not include the permission this page requires. If you need it, ask an
                  administrator to update your role.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button asChild>
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </AppShellProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider initialUser={await getCurrentUserAction()} idleWarningMs={idleWarningMs}>
      <AppShellProvider>{children}</AppShellProvider>
    </AuthProvider>
  );
}

/**
 * Builds a route's layout from the central policy table.
 *
 * Every protected route's layout was the same nine lines with one string
 * changed. This reduces each to a declaration of which route it is, and moves
 * the decision about who may open it into one auditable table.
 *
 * The permission is resolved when the module loads, so a route missing from the
 * table fails at build time rather than serving an unprotected page.
 *
 * This is deliberately a per-route layout rather than one shared layout for the
 * whole application: Next.js does not re-render a shared layout when navigating
 * between the routes beneath it, so a single layout that looked up the
 * permission by pathname would keep the answer from whichever page was opened
 * first.
 */
export function protectedLayout(route: string) {
  const permission = permissionForRoute(route);

  return function RouteLayout({ children }: { children: React.ReactNode }) {
    return <ProtectedShell permission={permission}>{children}</ProtectedShell>;
  };
}
