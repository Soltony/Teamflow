/**
 * Fixed-window rate limiting.
 *
 * Adapted from the GuessLow console. Per-account lockout already stops one
 * account being ground down, but it does nothing about the two attacks that do
 * not target a single account: spraying one common password across many
 * accounts, and hammering an unauthenticated endpoint that has no account to
 * lock. A window keyed on the caller closes both.
 *
 * The counters live in process memory. On a single instance that is exact; run
 * more than one and each holds its own window, so the effective ceiling is the
 * configured limit times the instance count. That is a weaker guarantee than a
 * shared store would give, and the upgrade path is Redis — but a limit that is
 * loose by a known factor is still the difference between thousands of attempts
 * a minute and a handful.
 */

export interface RateLimitRule {
  /** Attempts permitted inside one window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Attempts still available in the current window. */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Bounds memory if a flood arrives with a high-cardinality key. */
const MAX_TRACKED_KEYS = 20_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Named rules, so a limit is described in one place rather than at each call site. */
export const RATE_LIMITS = {
  /** Sign-in, keyed on the caller's address. Tight: a real user needs a few tries. */
  login: { limit: 10, windowMs: 5 * 60_000 },
  /** Sign-in attempts against one specific phone number, across addresses. */
  loginPerAccount: { limit: 8, windowMs: 15 * 60_000 },
  /** Password change — authenticated, but a guessing oracle for the current password. */
  passwordChange: { limit: 10, windowMs: 15 * 60_000 },
  /** Administrator actions that mint credentials. */
  credentialIssue: { limit: 30, windowMs: 10 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Records one attempt against `name:key` and reports whether it is allowed.
 *
 * Counts the attempt even when it fails the check, so a caller that keeps
 * trying keeps the window open rather than being let through the moment it
 * would otherwise have reset.
 */
export function consumeRateLimit(
  name: RateLimitName,
  key: string,
  rule: RateLimitRule = RATE_LIMITS[name],
): RateLimitResult {
  const now = Date.now();

  if (windows.size > MAX_TRACKED_KEYS) sweep(now);

  const composite = `${name}:${key}`;
  const existing = windows.get(composite);

  if (!existing || existing.resetAt <= now) {
    windows.set(composite, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, rule.limit - existing.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return { ok: existing.count <= rule.limit, remaining, retryAfterSeconds };
}

/** Clears one caller's window — used after a successful sign-in. */
export function clearRateLimit(name: RateLimitName, key: string) {
  windows.delete(`${name}:${key}`);
}

/** Test helper. */
export function resetAllRateLimits() {
  windows.clear();
}
