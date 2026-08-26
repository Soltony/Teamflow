import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { isKnownAppPath } from '@/lib/permissions';

/**
 * First line of defence only.
 *
 * Middleware runs on the Edge runtime, where Prisma is unavailable, so this
 * can do no more than check that a session cookie is present. It exists to
 * bounce anonymous visitors straight to the login page instead of letting them
 * render a page shell first.
 *
 * The authoritative checks — is the session real, unexpired, and does the user
 * hold the permission this route needs — happen in the route guard
 * (components/protected-shell.tsx) and in every server action via
 * requireUser()/requirePermission(). Never rely on this file alone.
 */

const PUBLIC_PATHS = ['/login'];

/**
 * Routes that authenticate themselves and should answer with a status code
 * rather than a redirect. The document download route returns 401/403/404 of
 * its own, which is what a fetch() can act on; bouncing it to the login page
 * would hand the caller an HTML document where it expected a file.
 */
const SELF_AUTHENTICATING_PREFIXES = ['/api/'];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (SELF_AUTHENTICATING_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    // Always let the login page render.
    //
    // This deliberately does NOT bounce visitors who happen to hold a cookie.
    // Middleware can see that a cookie exists but not whether the session
    // behind it is still valid, and an expired, revoked or idled-out cookie
    // looks exactly like a live one from here. Redirecting on presence alone
    // produced a loop that locked people out completely: /dashboard let them
    // through, the route guard found the session dead and sent them to /login,
    // and this line sent them straight back. Sending someone who is genuinely
    // signed in to the dashboard is a convenience, so it belongs where the
    // session can actually be checked — see src/app/login/layout.tsx.
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);

    // Only remember where the visitor was heading when it is somewhere this
    // application actually serves, and when the browser was navigating rather
    // than fetching a subresource. Otherwise a 404 probe or an asset request
    // becomes the destination after a successful sign-in.
    const isDocumentRequest =
      request.headers.get('sec-fetch-dest') === 'document' ||
      (request.headers.get('accept') ?? '').includes('text/html');

    if (pathname !== '/' && isDocumentRequest && isKnownAppPath(pathname)) {
      loginUrl.searchParams.set('from', pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next internals and public static assets.
   *
   * The PWA files must stay reachable without a session, or the browser gets
   * the login page's HTML where it expected a manifest or a service worker.
   * Note that `app/manifest.ts` is served at /manifest.webmanifest, not
   * /manifest.json — excluding only the latter left the manifest being
   * redirected to /login.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|workbox-.*|img/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|webmanifest)$).*)',
  ],
};
