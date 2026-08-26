import * as z from 'zod';

/**
 * The password policy as a Zod schema, so the same rules run in the browser
 * (for immediate feedback) and on the server (where they are enforced).
 * Mirrors validatePasswordStrength in lib/auth/password.ts, which is the
 * authority — this file must not diverge from it.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_POLICY_HINT =
  'At least 8 characters, with an uppercase letter, a lowercase letter, a digit, and a symbol.';

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[0-9]/, 'Password must contain a digit.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol.');
