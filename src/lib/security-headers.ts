/**
 * Response headers every route gets.
 *
 * Adapted from the GuessLow console, which applies the same set. Kept free of
 * Node-only imports so it can be read from next.config.ts at build time and
 * from the Edge middleware.
 */

/**
 * Browser features this application never uses.
 *
 * Exhaustive rather than illustrative: `Permissions-Policy` denies only what it
 * names, so every capability left off the list stays available to any script
 * that manages to run — which is the situation the policy exists for.
 */
const DENIED_FEATURES = [
  'accelerometer',
  'ambient-light-sensor',
  'autoplay',
  'battery',
  'bluetooth',
  'camera',
  'display-capture',
  'encrypted-media',
  'gamepad',
  'geolocation',
  'gyroscope',
  'hid',
  'idle-detection',
  'local-fonts',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'picture-in-picture',
  'publickey-credentials-get',
  'screen-wake-lock',
  'serial',
  'speaker-selection',
  'storage-access',
  'usb',
  'web-share',
  'xr-spatial-tracking',
];

export const PERMISSIONS_POLICY = DENIED_FEATURES.map((feature) => `${feature}=()`).join(', ');

/**
 * Where this application may be framed.
 *
 * `'none'` unless an operator deliberately embeds it: a clickjacked frame over
 * the EPMO console can approve a payment or a timeline extension with one
 * misdirected click, so the default has to be refusal rather than a wildcard.
 */
export function frameAncestors(): string {
  const configured = (process.env.FRAME_ANCESTORS || '').trim();
  if (!configured) return "'none'";
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * `X-Frame-Options` for browsers that predate `frame-ancestors`. It cannot
 * express an allow-list, so it is emitted only for the deny-everything case;
 * where a frame is permitted, `frame-ancestors` is the authority.
 */
export function frameOptionsHeader(): string | null {
  return frameAncestors() === "'none'" ? 'DENY' : null;
}

/**
 * Content Security Policy.
 *
 * `script-src` still needs `'unsafe-inline'`: the App Router emits inline
 * bootstrap and flight-data scripts, and suppressing them requires a per-request
 * nonce threaded through the middleware. That is the next step, not a reason to
 * ship no policy at all — everything else here is already restrictive, and
 * `object-src`, `base-uri` and `form-action` close the injection routes that do
 * not depend on running script.
 */
export function buildCsp({ isDev = false }: { isDev?: boolean } = {}): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-eval' is required by React Refresh in development only.
    'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Tailwind and Radix inject style attributes at runtime.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Avatars may be hosted anywhere; images cannot execute.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(isDev ? ['ws:', 'wss:'] : [])],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'frame-ancestors': [frameAncestors()],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');

  // Only meaningful over HTTPS, and it would break local development.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

/** The headers applied to every response. */
export function securityHeaders({ isDev = false }: { isDev?: boolean } = {}) {
  const headers = [
    { key: 'Content-Security-Policy', value: buildCsp({ isDev }) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ];

  const frameOptions = frameOptionsHeader();
  if (frameOptions) headers.push({ key: 'X-Frame-Options', value: frameOptions });

  // HSTS instructs the browser to refuse plain HTTP for this host from now on.
  // Emitting it in development would make localhost unreachable over http.
  if (!isDev) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
