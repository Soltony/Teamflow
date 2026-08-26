'use server';

import { revalidatePath } from 'next/cache';

import prisma from '@/lib/db';
import { requireUser } from '@/lib/auth/guard';
import { normalizePhoneNumber } from '@/lib/auth/phone';
import { changePasswordAction } from '@/app/auth/actions';

/**
 * Profile management. Previously these actions forwarded to an external
 * identity service; email, phone, and password now live in this system's own
 * User table.
 */

/**
 * Updates the signed-in user's own contact details.
 *
 * The user id is taken from the session, never from the caller: the previous
 * version accepted it as an argument, which let anyone edit anyone's profile.
 * The parameter is retained so existing call sites keep compiling, but its
 * value is ignored.
 */
export async function updateUserProfile(
  _userId: string | undefined,
  data: { email: string; phoneNumber: string },
): Promise<{ success: true } | { success: false; error: string }> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { success: false, error: 'You are not signed in.' };
  }

  const email = (data?.email ?? '').trim().toLowerCase();
  const phoneNumber = normalizePhoneNumber(data?.phoneNumber);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Enter a valid email address.' };
  }
  if (!phoneNumber) {
    return {
      success: false,
      error: 'Enter a valid Ethiopian phone number, for example 0912345678.',
    };
  }

  const clash = await prisma.user.findFirst({
    where: {
      id: { not: user.id },
      OR: [{ email }, { phoneNumber }],
    },
    select: { email: true, phoneNumber: true },
  });

  if (clash) {
    return {
      success: false,
      error:
        clash.email === email
          ? 'That email address is already used by another account.'
          : 'That phone number is already used by another account.',
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email, phoneNumber },
  });

  revalidatePath('/profile');
  return { success: true };
}

/**
 * Changes the signed-in user's password.
 *
 * Delegates to the shared action so there is one implementation of the rule
 * that a password change revokes every session.
 */
export async function changePassword(data: {
  currentPassword?: string;
  newPassword?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  return changePasswordAction({
    currentPassword: data?.currentPassword ?? '',
    newPassword: data?.newPassword ?? '',
  });
}
