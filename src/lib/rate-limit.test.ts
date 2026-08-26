import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RATE_LIMITS,
  clearRateLimit,
  consumeRateLimit,
  resetAllRateLimits,
} from './rate-limit';

afterEach(() => {
  resetAllRateLimits();
  vi.useRealTimers();
});

describe('consumeRateLimit', () => {
  it('allows attempts up to the limit and refuses the one after', () => {
    const rule = { limit: 3, windowMs: 60_000 };
    const results = Array.from({ length: 4 }, () => consumeRateLimit('login', 'caller', rule));

    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
  });

  it('reports how many attempts remain', () => {
    const rule = { limit: 3, windowMs: 60_000 };
    expect(consumeRateLimit('login', 'a', rule).remaining).toBe(2);
    expect(consumeRateLimit('login', 'a', rule).remaining).toBe(1);
    expect(consumeRateLimit('login', 'a', rule).remaining).toBe(0);
  });

  it('keeps separate counters per key, so one caller cannot lock out another', () => {
    const rule = { limit: 1, windowMs: 60_000 };
    expect(consumeRateLimit('login', 'caller-a', rule).ok).toBe(true);
    expect(consumeRateLimit('login', 'caller-b', rule).ok).toBe(true);
    expect(consumeRateLimit('login', 'caller-a', rule).ok).toBe(false);
  });

  it('keeps separate counters per rule name for the same key', () => {
    const rule = { limit: 1, windowMs: 60_000 };
    expect(consumeRateLimit('login', 'same', rule).ok).toBe(true);
    expect(consumeRateLimit('passwordChange', 'same', rule).ok).toBe(true);
  });

  it('keeps counting while blocked, so hammering does not shorten the wait', () => {
    const rule = { limit: 1, windowMs: 60_000 };
    consumeRateLimit('login', 'k', rule);
    const first = consumeRateLimit('login', 'k', rule);
    const later = consumeRateLimit('login', 'k', rule);

    expect(first.ok).toBe(false);
    expect(later.ok).toBe(false);
    expect(later.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('starts a fresh window once the old one has passed', () => {
    vi.useFakeTimers();
    const rule = { limit: 1, windowMs: 1000 };

    expect(consumeRateLimit('login', 'k', rule).ok).toBe(true);
    expect(consumeRateLimit('login', 'k', rule).ok).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(consumeRateLimit('login', 'k', rule).ok).toBe(true);
  });

  it('gives a retry hint of at least one second while blocked', () => {
    const rule = { limit: 1, windowMs: 60_000 };
    consumeRateLimit('login', 'k', rule);
    expect(consumeRateLimit('login', 'k', rule).retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe('clearRateLimit', () => {
  it('restores a caller after a successful sign-in', () => {
    const rule = { limit: 1, windowMs: 60_000 };
    consumeRateLimit('login', 'k', rule);
    expect(consumeRateLimit('login', 'k', rule).ok).toBe(false);

    clearRateLimit('login', 'k');
    expect(consumeRateLimit('login', 'k', rule).ok).toBe(true);
  });

  it('clears only the named rule, leaving the other window intact', () => {
    const rule = { limit: 1, windowMs: 60_000 };
    consumeRateLimit('login', 'k', rule);
    consumeRateLimit('loginPerAccount', 'k', rule);

    clearRateLimit('login', 'k');

    expect(consumeRateLimit('login', 'k', rule).ok).toBe(true);
    expect(consumeRateLimit('loginPerAccount', 'k', rule).ok).toBe(false);
  });
});

describe('RATE_LIMITS', () => {
  it('defines a window for every named rule', () => {
    for (const [name, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.limit, name).toBeGreaterThan(0);
      expect(rule.windowMs, name).toBeGreaterThan(0);
    }
  });

  it('keeps sign-in tighter than the administrative rules', () => {
    expect(RATE_LIMITS.login.limit).toBeLessThan(RATE_LIMITS.credentialIssue.limit);
  });
});
