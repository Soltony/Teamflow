// Deliberately no 'server-only' guard: the migration and verification scripts
// under scripts/ import this module directly from Node. It holds pure crypto
// helpers and no secrets, and only server code references it in the app.
import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

/**
 * Password hashing compatible with ASP.NET Core Identity's PasswordHasher.
 *
 * The 50 credentials migrated from the legacy TeamAuthDb are all in the v3
 * format, so we must be able to verify them byte-for-byte or every existing
 * user would be locked out. Rather than introduce a second scheme, we keep
 * writing v3 — the format encodes its own iteration count and PRF, so it can
 * be strengthened over time without a flag day.
 *
 * v3 layout (all integers big-endian):
 *   [0]      0x01 format marker
 *   [1..4]   PRF   (0 = HMAC-SHA1, 1 = HMAC-SHA256, 2 = HMAC-SHA512)
 *   [5..8]   iteration count
 *   [9..12]  salt length in bytes
 *   [13..]   salt, then the derived subkey
 *
 * v2 layout (0x00 marker) is also accepted for completeness: 16-byte salt and
 * a 32-byte HMAC-SHA1 subkey at 1000 iterations.
 */

const V3_MARKER = 0x01;
const V2_MARKER = 0x00;

const PRF_TO_DIGEST: Record<number, string> = {
  0: 'sha1',
  1: 'sha256',
  2: 'sha512',
};

/**
 * Parameters used for newly created passwords. The legacy hashes use 100,000
 * iterations; new ones use OWASP's current PBKDF2-SHA512 guidance. Anyone whose
 * stored hash is weaker than this is transparently upgraded when they sign in.
 */
const CURRENT_PRF = 2; // HMAC-SHA512
const CURRENT_ITERATIONS = 210_000;
const CURRENT_SALT_BYTES = 16;
const CURRENT_SUBKEY_BYTES = 32;

export interface PasswordHashInfo {
  version: 2 | 3;
  digest: string;
  iterations: number;
  saltBytes: number;
  subkeyBytes: number;
}

/** Reads the parameters out of a stored hash without verifying anything. */
export function describeHash(storedHash: string): PasswordHashInfo | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(storedHash, 'base64');
  } catch {
    return null;
  }
  if (buf.length < 13) return null;

  if (buf[0] === V2_MARKER) {
    if (buf.length !== 1 + 16 + 32) return null;
    return { version: 2, digest: 'sha1', iterations: 1000, saltBytes: 16, subkeyBytes: 32 };
  }

  if (buf[0] !== V3_MARKER) return null;

  const prf = buf.readUInt32BE(1);
  const iterations = buf.readUInt32BE(5);
  const saltBytes = buf.readUInt32BE(9);
  const digest = PRF_TO_DIGEST[prf];
  const subkeyBytes = buf.length - 13 - saltBytes;

  if (!digest || saltBytes < 8 || subkeyBytes < 16 || iterations < 1) return null;

  return { version: 3, digest, iterations, saltBytes, subkeyBytes };
}

/**
 * Verifies a plaintext password against a stored hash.
 *
 * Returns `needsUpgrade` when the stored hash is valid but weaker than what we
 * write today, so the caller can re-hash while it holds the plaintext.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!storedHash) return { valid: false, needsUpgrade: false };

  const info = describeHash(storedHash);
  if (!info) return { valid: false, needsUpgrade: false };

  const buf = Buffer.from(storedHash, 'base64');
  const headerBytes = info.version === 3 ? 13 : 1;
  const salt = buf.subarray(headerBytes, headerBytes + info.saltBytes);
  const expected = buf.subarray(headerBytes + info.saltBytes);

  const actual = await pbkdf2Async(
    Buffer.from(password, 'utf8'),
    salt,
    info.iterations,
    info.subkeyBytes,
    info.digest,
  );

  // Both buffers are the same length by construction, but guard anyway so
  // timingSafeEqual cannot throw on malformed input.
  const valid = actual.length === expected.length && timingSafeEqual(actual, expected);

  const needsUpgrade =
    valid &&
    (info.version !== 3 || info.digest !== PRF_TO_DIGEST[CURRENT_PRF] || info.iterations < CURRENT_ITERATIONS);

  return { valid, needsUpgrade };
}

/** Produces a v3 hash using the current parameters. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(CURRENT_SALT_BYTES);
  const subkey = await pbkdf2Async(
    Buffer.from(password, 'utf8'),
    salt,
    CURRENT_ITERATIONS,
    CURRENT_SUBKEY_BYTES,
    PRF_TO_DIGEST[CURRENT_PRF],
  );

  const header = Buffer.alloc(13);
  header.writeUInt8(V3_MARKER, 0);
  header.writeUInt32BE(CURRENT_PRF, 1);
  header.writeUInt32BE(CURRENT_ITERATIONS, 5);
  header.writeUInt32BE(CURRENT_SALT_BYTES, 9);

  return Buffer.concat([header, salt, subkey]).toString('base64');
}

/** A readable temporary password for admin-issued resets. */
/**
 * @param length How long the generated password should be.
 *
 * Follows the configured minimum. It was fixed at fourteen, so raising the
 * minimum above that made every reset issue a password the system itself
 * would reject — handing an administrator a credential that could not be
 * used and leaving the account unusable.
 */
export function generateTemporaryPassword(length: number = TEMPORARY_PASSWORD_LENGTH): string {
  // Never shorter than the built-in floor, however small a number is passed.
  const target = Math.max(TEMPORARY_PASSWORD_LENGTH, Math.min(length, 64));
  // Avoids characters that are easy to misread when a password is dictated.
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*?';
  const all = upper + lower + digits + symbols;

  const pick = (set: string) => set[randomBytes(1)[0] % set.length];

  // Guarantee one of each class so the result always satisfies the policy.
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < target) chars.push(pick(all));

  // Fisher-Yates with cryptographic randomness so the guaranteed characters
  // are not always in the first four positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const PASSWORD_MIN_LENGTH = 8;

/** Comfortably above the minimum, and short enough to be dictated. */
export const TEMPORARY_PASSWORD_LENGTH = 14;

/**
 * Password policy. Mirrors the ASP.NET Identity defaults the legacy service
 * used, so no existing password becomes invalid on next change.
 */
/**
 * @param minLength The configured minimum. Passed in rather than read here:
 * this module stays free of Prisma so the migration scripts can import it,
 * and the caller already knows the setting. Never goes below the floor.
 */
export function validatePasswordStrength(
  password: string,
  minLength: number = PASSWORD_MIN_LENGTH,
): string | null {
  const floor = Math.max(PASSWORD_MIN_LENGTH, minLength);
  if (password.length < floor) {
    return `Password must be at least ${floor} characters.`;
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a digit.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol.';
  return null;
}
