import type { NextConfig } from 'next';

import { securityHeaders } from './src/lib/security-headers';

const isDev = process.env.NODE_ENV !== 'production';

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',

  /**
   * Off in development.
   *
   * A registered service worker keeps serving the JavaScript it cached, and
   * Server Action ids are content hashes of the build that produced them. The
   * combination means an edit to any action leaves the browser posting an id
   * the dev server has never compiled, which surfaces as
   * "Failed to find Server Action … This request might be from an older or
   * newer deployment" and a 404 on every submit.
   */
  disable: isDev,

  workboxOptions: {
    /**
     * Take over from the previous worker straight away rather than waiting for
     * every tab to close. Without these two, a deployment leaves existing
     * visitors on the old bundle — the same stale-action-id failure, but in
     * production and against real users.
     */
    skipWaiting: true,
    clientsClaim: true,
  },
});

const nextConfig: NextConfig = {
  /**
   * The compiler is the cheapest reviewer this project has.
   *
   * `ignoreBuildErrors` was true, which is how a route importing a relation
   * that did not exist in the schema, a Zod refinement missing its required
   * `code`, and an object literal assigning `milestoneId` twice all shipped
   * without complaint. It is off now, and the build fails on a type error
   * rather than deploying one.
   */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // Still on: the lint backlog is separate from the type backlog and has not
    // been worked through yet. Turning it off is the next step, not a
    // permanent state.
    ignoreDuringBuilds: true,
  },

  // Suppresses `X-Powered-By: Next.js`, which otherwise advertises the stack
  // and its likely version range to anyone who asks for a page.
  poweredByHeader: false,

  images: {
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders({ isDev }),
      },
    ];
  },
};

export default withPWA(nextConfig);
