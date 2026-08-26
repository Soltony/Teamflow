/**
 * Regression test for the stale-cookie redirect loop.
 *
 * A session that has expired, been revoked, or idled out leaves a cookie behind
 * that looks live to the Edge middleware. When the middleware decided sign-in
 * status from the cookie's presence alone, that produced a loop:
 *
 *   /dashboard -> cookie present, allowed -> route guard finds the session dead
 *              -> /login -> cookie present, "already signed in" -> /dashboard
 *
 * The user could never reach the login page, and the 15-minute idle timeout
 * made it a routine occurrence rather than an edge case.
 *
 *   npx tsx scripts/test-stale-session.ts http://localhost:3001
 */
import { PrismaClient } from '@prisma/client';
import { createHash, pbkdf2Sync, randomBytes } from 'crypto';

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? 'http://localhost:3001';

const PHONE = '0700000031';
const PASSWORD = 'Stale!Pass1';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

function hash(password: string) {
  const salt = randomBytes(16);
  const subkey = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, 210_000, 32, 'sha512');
  const header = Buffer.alloc(13);
  header[0] = 0x01;
  header.writeUInt32BE(2, 1);
  header.writeUInt32BE(210_000, 5);
  header.writeUInt32BE(16, 9);
  return Buffer.concat([header, salt, subkey]).toString('base64');
}

const get = (path: string, cookie?: string) =>
  fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: 'manual' });

/** Follows redirects by hand so a loop shows up as a repeated location. */
async function followChain(start: string, cookie: string, limit = 8) {
  const visited: string[] = [];
  let path = start;
  for (let i = 0; i < limit; i++) {
    const res = await get(path, cookie);
    visited.push(`${path} -> ${res.status}`);
    if (res.status !== 307 && res.status !== 302) break;
    const location = res.headers.get('location');
    if (!location) break;
    path = location.startsWith('http') ? new URL(location).pathname + new URL(location).search : location;
  }
  return visited;
}

async function main() {
  console.log(`\nStale-session handling against ${BASE}\n`);

  await prisma.session.deleteMany({ where: { user: { phoneNumber: PHONE } } });
  await prisma.authEvent.deleteMany({ where: { user: { phoneNumber: PHONE } } });
  await prisma.user.deleteMany({ where: { phoneNumber: PHONE } });

  const user = await prisma.user.create({
    data: {
      firstName: 'Stale', lastName: 'Tester', name: 'Stale Tester',
      email: 'stale.tester@example.invalid',
      phoneNumber: PHONE,
      passwordHash: hash(PASSWORD),
    },
  });

  /** Mints a cookie for a session row in whatever state the test needs. */
  async function sessionCookie(state: 'live' | 'expired' | 'revoked' | 'idle') {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    await prisma.session.create({
      data: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        userId: user.id,
        expiresAt: new Date(state === 'expired' ? now - 1000 : now + 7 * 24 * 3600_000),
        lastSeenAt: new Date(state === 'idle' ? now - 60 * 60_000 : now),
        revokedAt: state === 'revoked' ? new Date() : null,
      },
    });
    return `nibteam_session=${token}`;
  }

  for (const state of ['expired', 'revoked', 'idle'] as const) {
    const cookie = await sessionCookie(state);

    const chain = await followChain('/dashboard', cookie);
    const loops = chain.filter((s) => s.startsWith('/login')).length > 1;
    check(
      `a ${state} session does not loop between /login and /dashboard`,
      !loops,
      chain.join('  |  '),
    );

    const login = await get('/login', cookie);
    check(
      `a ${state} session can still reach the login page`,
      login.status === 200,
      `status ${login.status}, location ${login.headers.get('location') ?? '-'}`,
    );

    const dashboard = await get('/dashboard', cookie);
    check(
      `a ${state} session is still refused the dashboard`,
      dashboard.status === 307 || dashboard.status === 302,
      `status ${dashboard.status}`,
    );
  }

  // A live session must still be bounced away from the login page.
  const live = await sessionCookie('live');
  const liveLogin = await get('/login', live);
  check(
    'a live session visiting /login is sent to the dashboard',
    (liveLogin.headers.get('location') ?? '').includes('/dashboard'),
    `status ${liveLogin.status}, location ${liveLogin.headers.get('location') ?? '-'}`,
  );
  check('a live session can open the dashboard', (await get('/dashboard', live)).status === 200);

  // And anonymous visitors still get sent to sign in.
  const anon = await get('/dashboard');
  check(
    'an anonymous visitor is redirected to the login page',
    (anon.headers.get('location') ?? '').includes('/login'),
    `status ${anon.status}`,
  );
  check('the login page renders for an anonymous visitor', (await get('/login')).status === 200);

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.authEvent.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
