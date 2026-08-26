/**
 * The session cookie name, in its own module with no dependencies.
 *
 * middleware.ts runs on the Edge runtime and cannot import lib/auth/session.ts,
 * which pulls in Prisma and 'server-only'. Keeping the constant here lets both
 * the Edge middleware and the Node server code agree on one name.
 */
export const SESSION_COOKIE = 'nibteam_session';
