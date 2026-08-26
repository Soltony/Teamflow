import { afterEach, describe, expect, it } from 'vitest';

import {
  PERMISSIONS_POLICY,
  buildCsp,
  frameAncestors,
  frameOptionsHeader,
  securityHeaders,
} from './security-headers';
import { addressKey, clientAddress, trustsProxyHeaders, userAgent } from './request-context';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

const headersOf = (entries: Record<string, string>) => new Headers(entries);

describe('buildCsp', () => {
  it('refuses framing and plugin content by default', () => {
    const csp = buildCsp();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('upgrades insecure requests in production but not in development', () => {
    expect(buildCsp({ isDev: false })).toContain('upgrade-insecure-requests');
    expect(buildCsp({ isDev: true })).not.toContain('upgrade-insecure-requests');
  });

  it('allows eval only in development, where React Refresh needs it', () => {
    expect(buildCsp({ isDev: true })).toContain("'unsafe-eval'");
    expect(buildCsp({ isDev: false })).not.toContain("'unsafe-eval'");
  });

  it('allows websockets only in development, for HMR', () => {
    expect(buildCsp({ isDev: true })).toContain('ws:');
    expect(buildCsp({ isDev: false })).not.toContain('ws:');
  });

  it('keeps images permissive, since an image cannot execute', () => {
    expect(buildCsp()).toContain('img-src');
    expect(buildCsp()).toMatch(/img-src[^;]*https:/);
  });

  it('permits the service worker the PWA registers', () => {
    expect(buildCsp()).toMatch(/worker-src[^;]*blob:/);
  });
});

describe('frameAncestors', () => {
  it('refuses framing unless an operator opts in', () => {
    delete process.env.FRAME_ANCESTORS;
    expect(frameAncestors()).toBe("'none'");
    expect(frameOptionsHeader()).toBe('DENY');
  });

  it('honours a configured allow-list', () => {
    process.env.FRAME_ANCESTORS = 'https://portal.nibbank.com.et, https://intranet.nibbank.com.et';
    expect(frameAncestors()).toBe('https://portal.nibbank.com.et https://intranet.nibbank.com.et');
  });

  it('omits X-Frame-Options when an allow-list is set, since it cannot express one', () => {
    process.env.FRAME_ANCESTORS = 'https://portal.nibbank.com.et';
    expect(frameOptionsHeader()).toBeNull();
  });
});

describe('securityHeaders', () => {
  it('sends HSTS in production only', () => {
    const prod = securityHeaders({ isDev: false }).map((h) => h.key);
    const dev = securityHeaders({ isDev: true }).map((h) => h.key);
    expect(prod).toContain('Strict-Transport-Security');
    expect(dev).not.toContain('Strict-Transport-Security');
  });

  it('always sends the headers that cost nothing to send', () => {
    const keys = securityHeaders().map((h) => h.key);
    for (const expected of [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
    ]) {
      expect(keys).toContain(expected);
    }
  });

  it('denies each browser feature explicitly, since the policy is not deny-by-default', () => {
    expect(PERMISSIONS_POLICY).toContain('camera=()');
    expect(PERMISSIONS_POLICY).toContain('microphone=()');
    expect(PERMISSIONS_POLICY).toContain('geolocation=()');
    expect(PERMISSIONS_POLICY).toContain('payment=()');
  });
});

describe('clientAddress', () => {
  it('ignores forwarding headers unless the deployment says a proxy sets them', () => {
    delete process.env.TRUST_PROXY_HEADERS;
    expect(trustsProxyHeaders()).toBe(false);
    // Otherwise any caller picks their own rate-limit bucket and audit entry.
    expect(clientAddress(headersOf({ 'x-forwarded-for': '1.2.3.4' }))).toBeNull();
  });

  it('reads the original client from the left of X-Forwarded-For when trusted', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    expect(clientAddress(headersOf({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 10.0.0.2' }))).toBe('1.2.3.4');
  });

  it('falls back to X-Real-IP when trusted', () => {
    process.env.TRUST_PROXY_HEADERS = '1';
    expect(clientAddress(headersOf({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });

  it('buckets unattributable callers together rather than giving each a fresh allowance', () => {
    delete process.env.TRUST_PROXY_HEADERS;
    expect(addressKey(headersOf({}))).toBe('unknown-address');
    expect(addressKey(headersOf({ 'x-forwarded-for': '9.9.9.9' }))).toBe('unknown-address');
  });
});

describe('userAgent', () => {
  it('bounds the value so a long header cannot bloat a stored row', () => {
    expect(userAgent(headersOf({ 'user-agent': 'x'.repeat(2000) }))!.length).toBe(512);
  });

  it('returns null when absent', () => {
    expect(userAgent(headersOf({}))).toBeNull();
  });
});
