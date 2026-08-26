import { describe, expect, it } from 'vitest';

import { AUDIT_ACTIONS, diffFields, sanitizeDetails } from './audit-log';

describe('sanitizeDetails', () => {
  it('redacts credentials rather than storing them', () => {
    const out = sanitizeDetails({
      email: 'someone@nibbank.com.et',
      password: 'Sup3rSecret!',
      newPassword: 'Another1!',
      temporaryPassword: 'Handed0ver!',
      passwordHash: 'AQAAAAIAAYag...',
      token: 'abc.def.ghi',
      tokenHash: 'deadbeef',
    }) as Record<string, unknown>;

    expect(out.email).toBe('someone@nibbank.com.et');
    for (const key of ['password', 'newPassword', 'temporaryPassword', 'passwordHash', 'token', 'tokenHash']) {
      expect(out[key]).toBe('***REDACTED***');
    }
  });

  it('redacts regardless of how the key is capitalised', () => {
    const out = sanitizeDetails({ PassWord: 'x', AUTHORIZATION: 'Bearer y' }) as Record<string, unknown>;
    expect(out.PassWord).toBe('***REDACTED***');
    expect(out.AUTHORIZATION).toBe('***REDACTED***');
  });

  it('redacts credentials nested inside other objects', () => {
    const out = sanitizeDetails({
      user: { name: 'Tony', credentials: { password: 'nested' } },
    }) as any;
    expect(out.user.name).toBe('Tony');
    expect(out.user.credentials.password).toBe('***REDACTED***');
  });

  it('stops recursing rather than following a cycle forever', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;
    expect(() => sanitizeDetails(cyclic)).not.toThrow();
    expect(JSON.stringify(sanitizeDetails(cyclic))).toContain('max depth');
  });

  it('truncates a long string instead of storing all of it', () => {
    const out = sanitizeDetails({ note: 'x'.repeat(5000) }) as Record<string, string>;
    expect(out.note.length).toBeLessThan(5000);
    expect(out.note).toContain('truncated');
  });

  it('caps very large arrays', () => {
    const out = sanitizeDetails(Array.from({ length: 1000 }, (_, i) => i)) as unknown[];
    expect(out).toHaveLength(200);
  });

  it('renders dates as ISO strings so JSON round-trips', () => {
    const out = sanitizeDetails({ at: new Date('2026-08-22T09:00:00.000Z') }) as Record<string, string>;
    expect(out.at).toBe('2026-08-22T09:00:00.000Z');
  });

  it('turns a Prisma Decimal into a number rather than an empty object', () => {
    // Shape-compatible stand-in for Prisma's Decimal.
    const decimal = {
      toNumber: () => 1500.5,
      toFixed: (n: number) => (1500.5).toFixed(n),
      toString: () => '1500.5',
    };
    const out = sanitizeDetails({ amount: decimal }) as Record<string, unknown>;
    expect(out.amount).toBe(1500.5);
  });

  it('passes through primitives and null unchanged', () => {
    expect(sanitizeDetails(null)).toBeNull();
    expect(sanitizeDetails(undefined)).toBeUndefined();
    expect(sanitizeDetails(42)).toBe(42);
    expect(sanitizeDetails(true)).toBe(true);
  });
});

describe('diffFields', () => {
  it('reports only the fields that actually changed', () => {
    const before = { name: 'Core Banking', statusId: 's1', endDate: new Date('2026-01-01') };
    const after = { name: 'Core Banking', statusId: 's2', endDate: new Date('2026-01-01') };

    const diff = diffFields(before, after, ['name', 'statusId', 'endDate']);

    expect(diff).toEqual({ statusId: { from: 's1', to: 's2' } });
  });

  it('treats two dates with the same instant as unchanged', () => {
    const before = { endDate: new Date('2026-01-01T00:00:00Z') };
    const after = { endDate: new Date('2026-01-01T00:00:00Z') };
    expect(diffFields(before, after, ['endDate'])).toBeUndefined();
  });

  it('returns undefined when nothing changed, so no empty diff is stored', () => {
    const row = { a: 1, b: 'two' };
    expect(diffFields(row, { ...row }, ['a', 'b'])).toBeUndefined();
  });

  it('returns undefined when either side is missing', () => {
    expect(diffFields(null, { a: 1 }, ['a'])).toBeUndefined();
    expect(diffFields({ a: 1 }, null, ['a'])).toBeUndefined();
  });

  it('treats null and undefined as the same absence', () => {
    expect(diffFields({ a: null }, { a: undefined }, ['a'])).toBeUndefined();
  });
});

describe('AUDIT_ACTIONS', () => {
  it('has no duplicate values, so grouping a report by action is unambiguous', () => {
    const values = Object.values(AUDIT_ACTIONS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('names every action in past tense', () => {
    for (const value of Object.values(AUDIT_ACTIONS)) {
      expect(value).toMatch(
        /_(CREATED|UPDATED|DELETED|APPROVED|REJECTED|ENABLED|DISABLED|RESET|RAISED|RESOLVED|ESCALATED|DOWNLOADED|UPLOADED)$/,
      );
    }
  });
});
