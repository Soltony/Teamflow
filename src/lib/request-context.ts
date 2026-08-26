/**
 * Working out who a request came from.
 *
 * Adapted from the GuessLow console. The point of the trusted-proxy gate is
 * that `X-Forwarded-For` is a request header like any other: anyone can send
 * one. Reading it unconditionally means a caller picks their own identity, and
 * every rate limit keyed on "the client address" becomes bypassable by varying
 * a header — while the audit trail records whatever address the attacker chose.
 */

/**
 * Whether this deployment sits behind a proxy whose forwarding headers can be
 * believed. Off unless explicitly enabled, because believing them when nothing
 * strips them is worse than not reading them at all.
 */
export function trustsProxyHeaders(): boolean {
  const value = (process.env.TRUST_PROXY_HEADERS || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

type HeaderSource = Headers | { get(name: string): string | null };

/**
 * The caller's address, or null when it cannot be established.
 *
 * Returns null rather than a placeholder so a caller cannot be silently
 * bucketed together with everyone else whose address is unknown.
 */
export function clientAddress(headers: HeaderSource): string | null {
  if (trustsProxyHeaders()) {
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
      // The left-most entry is the original client; the rest are proxies.
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  }
  return null;
}

/**
 * A stable key for rate limiting.
 *
 * Falls back to a constant when the address is unknown, which deliberately
 * makes unattributable traffic share one bucket rather than each request
 * getting a fresh allowance.
 */
export function addressKey(headers: HeaderSource): string {
  return clientAddress(headers) ?? 'unknown-address';
}

/** User agent, bounded so a long header cannot bloat a stored row. */
export function userAgent(headers: HeaderSource): string | null {
  return headers.get('user-agent')?.slice(0, 512) ?? null;
}

/**
 * Rejects a state-changing request whose Origin is not this site.
 *
 * Server Actions carry a same-origin check of their own in Next.js, so this is
 * defence in depth rather than the only guard — but it is the check that keeps
 * working if that behaviour is ever relaxed by configuration.
 */
export function isSameOriginRequest(headers: HeaderSource, expectedHost: string | null): boolean {
  const origin = headers.get('origin');
  if (!origin) return true; // Same-origin navigations often omit it.
  if (!expectedHost) return false;
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}
