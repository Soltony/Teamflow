import { describe, expect, it } from 'vitest';
import { pbkdf2Sync, randomBytes } from 'crypto';

import {
  describeHash,
  generateTemporaryPassword,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from './password';

/**
 * An independent implementation of the ASP.NET Core Identity v3 layout, written
 * from the documented format rather than by reusing the module under test, so
 * that agreement between the two is evidence and not a tautology.
 */
function referenceV3Hash(password: string, salt: Buffer, iterations: number, prf: number, subkeyLen: number) {
  const digest = prf === 0 ? 'sha1' : prf === 1 ? 'sha256' : 'sha512';
  const subkey = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, iterations, subkeyLen, digest);
  const header = Buffer.alloc(13);
  header[0] = 0x01;
  header.writeUInt32BE(prf, 1);
  header.writeUInt32BE(iterations, 5);
  header.writeUInt32BE(salt.length, 9);
  return Buffer.concat([header, salt, subkey]).toString('base64');
}

/** The exact parameters every credential migrated from TeamAuthDb uses. */
const legacyHash = (password: string) =>
  referenceV3Hash(password, randomBytes(16), 100_000, 2, 32);

const PASSWORD = 'Str0ng!Passw0rd';

describe('describeHash', () => {
  it('reads the parameters out of a legacy hash', () => {
    expect(describeHash(legacyHash(PASSWORD))).toEqual({
      version: 3,
      digest: 'sha512',
      iterations: 100_000,
      saltBytes: 16,
      subkeyBytes: 32,
    });
  });

  it('rejects anything that is not a hash it can read', () => {
    expect(describeHash('not-base64-at-all!!')).toBeNull();
    expect(describeHash('')).toBeNull();
    expect(describeHash(Buffer.from([0x09, 1, 2, 3]).toString('base64'))).toBeNull();
  });
});

describe('verifyPassword', () => {
  it('accepts a password migrated from the legacy service', async () => {
    const stored = legacyHash(PASSWORD);
    await expect(verifyPassword(PASSWORD, stored)).resolves.toMatchObject({ valid: true });
  });

  it('flags a legacy hash for upgrade to the current iteration count', async () => {
    const result = await verifyPassword(PASSWORD, legacyHash(PASSWORD));
    expect(result.needsUpgrade).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = legacyHash(PASSWORD);
    await expect(verifyPassword('wrong', stored)).resolves.toMatchObject({ valid: false });
  });

  it('rejects a password differing only by trailing whitespace', async () => {
    const stored = legacyHash(PASSWORD);
    await expect(verifyPassword(`${PASSWORD} `, stored)).resolves.toMatchObject({ valid: false });
  });

  it('rejects an empty password against a real hash', async () => {
    await expect(verifyPassword('', legacyHash(PASSWORD))).resolves.toMatchObject({ valid: false });
  });

  it('fails closed when there is no stored hash', async () => {
    await expect(verifyPassword(PASSWORD, null)).resolves.toEqual({ valid: false, needsUpgrade: false });
    await expect(verifyPassword(PASSWORD, undefined)).resolves.toEqual({ valid: false, needsUpgrade: false });
  });

  it('fails closed on a malformed stored hash instead of throwing', async () => {
    await expect(verifyPassword(PASSWORD, 'garbage')).resolves.toEqual({ valid: false, needsUpgrade: false });
  });
});

describe('hashPassword', () => {
  it('writes v3/sha512 at the current iteration count', async () => {
    const info = describeHash(await hashPassword(PASSWORD))!;
    expect(info.version).toBe(3);
    expect(info.digest).toBe('sha512');
    expect(info.iterations).toBeGreaterThanOrEqual(210_000);
  });

  it('verifies, and is not itself flagged for upgrade', async () => {
    const stored = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored)).toEqual({ valid: true, needsUpgrade: false });
  });

  it('salts, so the same password hashes differently each time', async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it('produces a hash the reference implementation reproduces byte for byte', async () => {
    const stored = await hashPassword(PASSWORD);
    const info = describeHash(stored)!;
    const salt = Buffer.from(stored, 'base64').subarray(13, 13 + info.saltBytes);
    expect(referenceV3Hash(PASSWORD, salt, info.iterations, 2, info.subkeyBytes)).toBe(stored);
  });
});

describe('validatePasswordStrength', () => {
  it('accepts a compliant password', () => {
    expect(validatePasswordStrength(PASSWORD)).toBeNull();
  });

  it.each([
    ['too short', 'Ab1!'],
    ['no uppercase', 'abcdefg1!'],
    ['no lowercase', 'ABCDEFG1!'],
    ['no digit', 'Abcdefgh!'],
    ['no symbol', 'Abcdefg1'],
  ])('rejects a password with %s', (_label, candidate) => {
    expect(validatePasswordStrength(candidate)).not.toBeNull();
  });

  it('rejects an absurdly long password rather than hashing it', () => {
    expect(validatePasswordStrength('A1!a'.repeat(100))).not.toBeNull();
  });
});

describe('generateTemporaryPassword', () => {
  it('always satisfies the policy it has to pass', () => {
    for (let i = 0; i < 200; i++) {
      expect(validatePasswordStrength(generateTemporaryPassword())).toBeNull();
    }
  });

  it('does not repeat itself', () => {
    const generated = Array.from({ length: 200 }, () => generateTemporaryPassword());
    expect(new Set(generated).size).toBe(generated.length);
  });

  it('does not put the guaranteed character classes in fixed positions', () => {
    const firstCharClasses = new Set(
      Array.from({ length: 200 }, () => (/[A-Z]/.test(generateTemporaryPassword()[0]) ? 'upper' : 'other')),
    );
    expect(firstCharClasses.size).toBeGreaterThan(1);
  });
});
