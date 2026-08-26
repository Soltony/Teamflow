import 'server-only';

import { redirect } from 'next/navigation';

import prisma from '@/lib/db';
import {
  ADMIN_ROLE_NAME,
  canSeeAllProjects,
  isAdmin,
  resolvePermissions,
  userHasPermission,
} from './access';
import { getCurrentUser, type SessionUser } from '@/lib/auth/session';

export {
  ADMIN_ROLE_NAME,
  resolvePermissions,
  isAdmin,
  userHasPermission,
  canSeeAllProjects,
} from './access';

/** Thrown by the require* helpers so callers can distinguish auth failures. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'PASSWORD_CHANGE_REQUIRED',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Resolves the acting user for a server action, or throws.
 *
 * Every server action must call this (or `requirePermission`) before touching
 * data. Server Actions are public HTTP endpoints; without this they are open
 * to anyone who can read the client bundle.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('You are not signed in.', 'UNAUTHENTICATED');
  return user;
}

/** As `requireUser`, plus a permission check. */
export async function requirePermission(permission: string | string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!userHasPermission(user, permission)) {
    await recordAccessDenied(user.id, Array.isArray(permission) ? permission.join(' | ') : permission);
    throw new AuthError('You do not have permission to perform this action.', 'FORBIDDEN');
  }
  return user;
}

/**
 * As `requirePermission`, but returns the refusal instead of throwing.
 *
 * Actions that report failures as `{ success: false, error }` use this so a
 * permission boundary shows the user a clear message. Throwing there would
 * surface as an opaque 500, because Next hides error messages in production.
 * Both paths fail closed; only the reporting differs.
 */
export async function permit(
  permission?: string | string[],
): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; denied: { success: false; error: string } }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, denied: { success: false, error: 'You are not signed in. Please sign in again.' } };
  }
  if (permission && !userHasPermission(user, permission)) {
    await recordAccessDenied(user.id, Array.isArray(permission) ? permission.join(' | ') : permission);
    return {
      ok: false,
      denied: { success: false, error: 'You do not have permission to perform this action.' },
    };
  }
  return { ok: true, user };
}

/**
 * For pages and layouts: sends the visitor to the login page instead of
 * throwing, and preserves where they were heading.
 */
export async function requireUserOrRedirect(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?from=${encodeURIComponent(returnTo)}` : '/login');
  }
  return user;
}

/**
 * Page-level guard. Redirects instead of throwing.
 *
 * Server Components render in parallel with their layout, so a page that
 * throws still throws even though the layout is about to redirect — which
 * filled the server log with `AuthError: You are not signed in` for every
 * anonymous request. Pages use this; server actions use requirePermission,
 * where throwing is the correct fail-closed behaviour.
 */
export async function requirePermissionOrRedirect(
  permission: string | string[],
  returnTo?: string,
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?from=${encodeURIComponent(returnTo)}` : '/login');
  }
  if (!userHasPermission(user, permission)) {
    await recordAccessDenied(user.id, Array.isArray(permission) ? permission.join(' | ') : permission);
    // The route guard renders a proper "no access" page; reaching here means
    // the page was entered another way, so send them somewhere they can use.
    redirect('/dashboard');
  }
  return user;
}

async function recordAccessDenied(userId: string, permission: string) {
  await prisma.authEvent
    .create({
      data: { type: 'ACCESS_DENIED', userId, subject: permission, detail: `Missing permission: ${permission}` },
    })
    .catch(() => undefined);
}

/**
 * Standard shape for server actions that return a result object rather than
 * throwing, so the existing UI error handling keeps working unchanged.
 */
export type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? Record<string, never> : T))
  | { success: false; error: string; code?: string };

/**
 * Runs `fn` and converts an AuthError into a result object. Use for actions
 * whose callers show `result.error` in a toast.
 */
export async function guarded<T>(
  fn: () => Promise<T>,
): Promise<T | { success: false; error: string; code: string }> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message, code: error.code };
    }
    throw error;
  }
}
