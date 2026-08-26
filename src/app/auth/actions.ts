'use server';

import { revalidatePath } from 'next/cache';
import type { AuthEventType } from '@prisma/client';

import prisma from '@/lib/db';
import { getNumber } from '@/lib/settings';
import { normalizePhoneNumber } from '@/lib/auth/phone';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '@/lib/auth/password';
import {
  createSession,
  destroyCurrentSession,
  getCurrentUser,
  revokeAllSessionsForUser,
} from '@/lib/auth/session';
import { requireUser, resolvePermissions, isAdmin } from '@/lib/auth/guard';
import { clearRateLimit, consumeRateLimit } from '@/lib/rate-limit';
import { addressKey } from '@/lib/request-context';
import { headers } from 'next/headers';

/**
 * Authentication is now owned by this application. There is no call to an
 * external identity service anywhere in this file.
 */

/**
 * Lockout policy, read from settings rather than compiled in.
 *
 * These are the bank's numbers to choose, not a developer's. Both are
 * clamped on read, so a value outside the declared bounds cannot disable
 * lockout however it reached the table.
 */
async function lockoutPolicy() {
  const [maxAttempts, lockoutMinutes] = await Promise.all([
    getNumber('security.maxFailedLogins'),
    getNumber('security.lockoutMinutes'),
  ]);
  return { maxAttempts, lockoutMs: lockoutMinutes * 60_000 };
}

/** Same message for every failure, so sign-in cannot be used to enumerate accounts. */
const GENERIC_LOGIN_ERROR = 'Incorrect phone number or password.';

async function record(
  type: AuthEventType,
  opts: { userId?: string | null; subject?: string | null; detail?: string | null } = {},
) {
  await prisma.authEvent
    .create({
      data: {
        type,
        userId: opts.userId ?? null,
        subject: opts.subject ?? null,
        detail: opts.detail ?? null,
      },
    })
    .catch(() => undefined);
}

export interface CurrentUserPayload {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
  phoneNumber: string | null;
  pmoDivisionId: string | null;
  mustChangePassword: boolean;
  roles: { id: string; name: string; description: string | null; permissions: string[] }[];
  permissions: string[];
  isAdmin: boolean;
}

function toPayload(user: Awaited<ReturnType<typeof requireUser>>): CurrentUserPayload {
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar,
    phoneNumber: user.phoneNumber,
    pmoDivisionId: user.pmoDivisionId,
    mustChangePassword: user.mustChangePassword,
    roles: user.roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
    })),
    permissions: [...resolvePermissions(user)],
    isAdmin: isAdmin(user),
  };
}

/** Returns the signed-in user for the client context, or null. */
export async function getCurrentUserAction(): Promise<CurrentUserPayload | null> {
  const user = await getCurrentUser();
  return user ? toPayload(user) : null;
}

export type LoginResult =
  | { success: true; mustChangePassword: boolean }
  | { success: false; error: string };

export async function loginAction(input: {
  phoneNumber: string;
  password: string;
}): Promise<LoginResult> {
  const phone = normalizePhoneNumber(input?.phoneNumber);
  const password = typeof input?.password === 'string' ? input.password : '';

  // Two windows, because they stop different attacks: one caller grinding
  // through passwords, and one password sprayed at many accounts. Per-account
  // lockout below handles neither on its own.
  const callerKey = addressKey(await headers());
  const byCaller = consumeRateLimit('login', callerKey);
  const byAccount = phone ? consumeRateLimit('loginPerAccount', phone) : { ok: true, retryAfterSeconds: 0 };

  if (!byCaller.ok || !byAccount.ok) {
    const wait = Math.max(byCaller.retryAfterSeconds, byAccount.retryAfterSeconds);
    await record('LOGIN_FAILED', { subject: phone ?? input?.phoneNumber ?? null, detail: 'Rate limited' });
    return {
      success: false,
      error: `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`,
    };
  }

  if (!phone || !password) {
    await record('LOGIN_FAILED', { subject: input?.phoneNumber ?? null, detail: 'Missing credentials' });
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  const user = await prisma.user.findUnique({
    where: { phoneNumber: phone },
    include: { roles: true },
  });

  // No local user: this may be one of the accounts migrated from the legacy
  // auth service that had never signed in here. Their credential is staged in
  // PendingUser and the User record is created on first successful sign-in.
  if (!user) {
    return loginPendingUser(phone, password);
  }

  if (!user.isActive) {
    await record('LOGIN_FAILED', { userId: user.id, subject: phone, detail: 'Account disabled' });
    return { success: false, error: 'This account has been disabled. Contact your administrator.' };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await record('LOGIN_FAILED', { userId: user.id, subject: phone, detail: 'Account locked' });
    return {
      success: false,
      error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    };
  }

  const { valid, needsUpgrade } = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const { maxAttempts, lockoutMs } = await lockoutPolicy();
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= maxAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + lockoutMs) : null,
      },
    });
    await record(shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', {
      userId: user.id,
      subject: phone,
      detail: shouldLock ? `Locked after ${maxAttempts} failed attempts` : `Attempt ${attempts}`,
    });
    return {
      success: false,
      error: shouldLock
        ? `Too many failed attempts. Try again in ${Math.round(lockoutMs / 60000)} minutes.`
        : GENERIC_LOGIN_ERROR,
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      // Re-hash with current parameters while we still hold the plaintext.
      ...(needsUpgrade ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  await createSession(user.id);
  await record('LOGIN_SUCCEEDED', { userId: user.id, subject: phone });

  // A legitimate sign-in should not leave the caller near their ceiling.
  clearRateLimit('login', callerKey);
  clearRateLimit('loginPerAccount', phone);

  return { success: true, mustChangePassword: user.mustChangePassword };
}

/**
 * Signs in a migrated account that has no local User record yet, creating one
 * on the way through. Mirrors the old syncUser behaviour, which created the
 * local record the first time someone reached the application.
 */
async function loginPendingUser(phone: string, password: string): Promise<LoginResult> {
  const pending = await prisma.pendingUser.findUnique({ where: { phoneNumber: phone } });
  if (!pending) {
    await record('LOGIN_FAILED', { subject: phone, detail: 'No such account' });
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  const { valid } = await verifyPassword(password, pending.passwordHash);
  if (!valid) {
    await record('LOGIN_FAILED', { subject: phone, detail: 'Bad password (pending account)' });
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  // Keep the legacy id so any historical reference to this person still resolves.
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: pending.id,
        name: `${pending.firstName} ${pending.lastName}`.trim(),
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        phoneNumber: pending.phoneNumber,
        passwordHash: pending.passwordHash,
        mustChangePassword: pending.mustChangePassword,
        lastLoginAt: new Date(),
      },
    });
    await tx.pendingUser.delete({ where: { id: pending.id } });
    return user;
  });

  await createSession(created.id);
  await record('LOGIN_SUCCEEDED', {
    userId: created.id,
    subject: phone,
    detail: 'First sign-in; local user created from migrated credential',
  });

  return { success: true, mustChangePassword: created.mustChangePassword };
}

export async function logoutAction(): Promise<{ success: true }> {
  const user = await getCurrentUser();
  await destroyCurrentSession('LOGOUT');
  if (user) await record('LOGGED_OUT', { userId: user.id });
  return { success: true };
}

/**
 * Changes the caller's own password.
 *
 * Every session is revoked, including this one, so the change takes effect on
 * all devices immediately and the user must sign in again with the new
 * password.
 */
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { success: false, error: 'You are not signed in.' };
  }

  const currentPassword = input?.currentPassword ?? '';
  const newPassword = input?.newPassword ?? '';

  // Authenticated, but still an oracle for the current password.
  const limited = consumeRateLimit('passwordChange', user.id);
  if (!limited.ok) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const { valid } = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    await record('LOGIN_FAILED', { userId: user.id, detail: 'Wrong current password on change' });
    return { success: false, error: 'Your current password is incorrect.' };
  }

  const policyError = validatePasswordStrength(newPassword, await getNumber('security.passwordMinLength'));
  if (policyError) return { success: false, error: policyError };

  if (currentPassword === newPassword) {
    return { success: false, error: 'The new password must be different from the current one.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const revoked = await revokeAllSessionsForUser(user.id, 'PASSWORD_CHANGED');
  await record('PASSWORD_CHANGED', {
    userId: user.id,
    detail: `${revoked} session(s) revoked`,
  });

  // Clear our own cookie too, so the browser is not left holding a dead token.
  await destroyCurrentSession('PASSWORD_CHANGED');

  revalidatePath('/profile');
  return { success: true };
}
