import { describe, expect, it } from 'vitest';

import { users } from './data';

/**
 * The seed data has to satisfy the schema's unique constraints.
 *
 * Two demo users shared a phone number, which is `@unique`. Seeding therefore
 * failed part-way through with a P2002 on every fresh machine — after it had
 * already deleted everything, leaving a half-populated database.
 */
describe('seed users', () => {
  it('gives every user a distinct phone number', () => {
    const seen = new Map<string, string[]>();
    for (const user of users) {
      const existing = seen.get(user.phoneNumber) ?? [];
      existing.push(user.name);
      seen.set(user.phoneNumber, existing);
    }
    const clashes = [...seen.entries()].filter(([, names]) => names.length > 1);
    expect(
      clashes,
      clashes.map(([phone, names]) => `${phone} is shared by ${names.join(' and ')}`).join('; '),
    ).toEqual([]);
  });

  it('gives every user a distinct email', () => {
    // The seed upserts on email, so a duplicate would silently overwrite
    // rather than fail — quieter, but just as wrong.
    const emails = users.map((u) => u.email.toLowerCase());
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('gives every user a distinct id', () => {
    const ids = users.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every user a phone number the system can normalise', () => {
    // Sign-in looks accounts up by normalised phone number. A seed user whose
    // number does not normalise could never sign in.
    for (const user of users) {
      expect(user.phoneNumber, user.name).toMatch(/^0\d{9}$/);
    }
  });
});
