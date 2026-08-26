import { describe, expect, it } from 'vitest';

import { normalizePhoneNumber, toInternationalPhoneNumber } from './phone';

describe('normalizePhoneNumber', () => {
  it('maps every written form of one number to the same value', () => {
    const forms = [
      '0912345678',
      '+251912345678',
      '251912345678',
      '00251912345678',
      '912345678',
      '0912 345 678',
      '091-234-5678',
      '(091) 234 5678',
    ];
    for (const form of forms) {
      expect(normalizePhoneNumber(form), form).toBe('0912345678');
    }
  });

  it('is what lets a login typed either way find the same account', () => {
    // The app's User table stores the local form; the legacy auth database
    // stored the international one.
    expect(normalizePhoneNumber('+251989736223')).toBe(normalizePhoneNumber('0989736223'));
  });

  it('rejects input that cannot be a number here', () => {
    for (const bad of ['', '   ', 'abc', '12', '09123456789012', '+1 555 0100']) {
      expect(normalizePhoneNumber(bad), bad).toBeNull();
    }
  });

  it('rejects null and undefined', () => {
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(normalizePhoneNumber(undefined)).toBeNull();
  });

  it('is idempotent', () => {
    const once = normalizePhoneNumber('+251912345678')!;
    expect(normalizePhoneNumber(once)).toBe(once);
  });
});

describe('toInternationalPhoneNumber', () => {
  it('produces the +251 form from any accepted input', () => {
    expect(toInternationalPhoneNumber('0912345678')).toBe('+251912345678');
    expect(toInternationalPhoneNumber('251912345678')).toBe('+251912345678');
  });

  it('returns null for input that is not a valid number', () => {
    expect(toInternationalPhoneNumber('nope')).toBeNull();
  });

  it('round-trips with normalizePhoneNumber', () => {
    const local = '0912345678';
    expect(normalizePhoneNumber(toInternationalPhoneNumber(local))).toBe(local);
  });
});
