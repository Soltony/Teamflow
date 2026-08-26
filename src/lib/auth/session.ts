import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createHash, randomBytes } from 'crypto';
import type { Role, User } from '@prisma/client';

import prisma from '@/lib/db';
import { getNumber } from '@/lib/settings';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';

export { SESSION_COOKIE };

/**
 * Session lifetimes, read from settings.
 *
 * These were compiled-in constants: seven days absolute, fifteen minutes
 * idle. Both are policy the bank's security people own, and changing either
 * meant a deployment. The defaults are unchanged, so behaviour is the same
 * until somebody decides otherwise.
 *
 * Both are clamped when read, so a session cannot be made to last forever or
 * to expire instantly by writing a stray value to the table.
 */
export async function sessionAbsoluteMs(): Promise<number> {
  return (await getNumber('security.sessionAbsoluteHours')) * 60 * 60 * 1000;
}

export async function sessionIdleMs(): Promise<number> {
  return (await getNumber('security.sessionIdleMinutes')) * 60 * 1000;
}

/** The compiled-in defaults, for callers that cannot await — the sweeper.  */
export const SESSION_ABSOLUTE_MS_DEFAULT = 7 * 24 * 60 * 60 * 1000;

/** Only touch lastSeenAt this often, to keep reads from writing on every request. */
const LAST_SEEN_THROTTLE_MS = 60 * 1000;

export type SessionUser = User & { roles: Role[] };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function requestContext() {
  try {
    const h = await headers();
    return {
      ipAddress:
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        h.get('x-real-ip') ||
        null,
      userAgent: h.get('user-agent')?.slice(0, 512) ?? null,
    };
  } catch {
    // headers() is unavailable outside a request (e.g. a CLI script).
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Issues a new session and sets its cookie.
 * Only callable from a Server Action or Route Handler — Next.js forbids
 * writing cookies while rendering.
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const { ipAddress, userAgent } = await requestContext();
  const absoluteMs = await sessionAbsoluteMs();

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + absoluteMs),
      ipAddress,
      userAgent,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(absoluteMs / 1000),
  });

  return token;
}

/**
 * Resolves the signed-in user, or null.
 *
 * Wrapped in React's `cache` so a render that checks permissions in a layout
 * and again in a page performs a single query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Deliberately not wrapped in try/catch: during static generation `cookies()`
  // throws a control-flow error that tells Next to render this route
  // dynamically instead. Swallowing it makes Next prerender pages that depend
  // on the session, which then fail the build with "You are not signed in".
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { roles: true } } },
  });

  if (!session) return null;

  const now = Date.now();
  const expired = session.expiresAt.getTime() <= now;
  const idledOut = now - session.lastSeenAt.getTime() > (await sessionIdleMs());

  if (session.revokedAt || expired || idledOut) {
    // Clean up so the row does not linger, but never throw from a read path.
    if (!session.revokedAt) {
      await prisma.session
        .update({
          where: { id: session.id },
          data: { revokedAt: new Date(), revokedReason: expired ? 'EXPIRED' : 'IDLE_TIMEOUT' },
        })
        .catch(() => undefined);
    }
    return null;
  }

  if (!session.user.isActive) return null;

  if (now - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return session.user;
});

/** Revokes the caller's session and clears the cookie. */
export async function destroyCurrentSession(reason = 'LOGOUT'): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      })
      .catch(() => undefined);
  }

  store.delete(SESSION_COOKIE);
}

/**
 * Revokes every session for a user. This is what makes a password change take
 * effect everywhere immediately, including on other devices.
 */
export async function revokeAllSessionsForUser(userId: string, reason: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

/** Deletes rows for sessions that can no longer be used. */
export async function pruneExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - SESSION_ABSOLUTE_MS_DEFAULT);
  const result = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }] },
  });
  return result.count;
}
