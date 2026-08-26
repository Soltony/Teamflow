/**
 * End-to-end authentication tests, driven over real HTTP against a running
 * production build.
 *
 *   npx next build && npx next start -p 3399
 *   npx tsx scripts/test-auth-e2e.ts http://localhost:3399
 *
 * Test accounts use 07xxxxxxxx phone numbers, which no real account uses, and
 * are deleted at the end. No existing user, project, or role is modified.
 */
import { PrismaClient } from '@prisma/client';
import { pbkdf2Sync, randomBytes } from 'crypto';

import { describeHash } from '../src/lib/auth/password';
import { soleActionIdFor } from './lib/action-ids';
import { assertServerMatchesBuild } from './lib/build-check';

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? 'http://localhost:3399';

// Read out of the current build: these ids are content hashes and change
// whenever the code does.
const ACTION_LOGIN = soleActionIdFor('login');
const ACTION_CHANGE_PASSWORD = soleActionIdFor('change-password');

const TEST_PREFIX = '070000';
const LEGACY_PASSWORD = 'Legacy!Pass1';
const NEW_PASSWORD = 'Brand!New2';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}\n`);
}

/** Reproduces exactly what the legacy .NET service stored: v3, SHA512, 100k. */
function legacyHash(password: string) {
  const salt = randomBytes(16);
  const subkey = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, 100_000, 32, 'sha512');
  const header = Buffer.alloc(13);
  header[0] = 0x01;
  header.writeUInt32BE(2, 1); // HMAC-SHA512
  header.writeUInt32BE(100_000, 5);
  header.writeUInt32BE(16, 9);
  return Buffer.concat([header, salt, subkey]).toString('base64');
}

function cookieFrom(res: Response): string | null {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  const match = /nibteam_session=([^;]*)/.exec(raw);
  if (!match || !match[1]) return null;
  return `nibteam_session=${match[1]}`;
}

/**
 * Invokes a server action over HTTP the way the browser does.
 *
 * `path` matters: the action must be reachable from that route's module graph,
 * and the route must not redirect first. Sign-in therefore posts to /login
 * (no session yet), while the password change posts to /profile — posting it
 * to /login would be bounced to /dashboard by the middleware, because the
 * caller already holds a session.
 */
async function callAction(actionId: string, args: unknown[], cookie?: string, path = '/login') {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Next-Action': actionId,
      'Content-Type': 'text/plain;charset=UTF-8',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(args),
    redirect: 'manual',
  });
  const text = await res.text();
  return { res, text, cookie: cookieFrom(res) };
}

const changePassword = (args: unknown[], cookie?: string) =>
  callAction(ACTION_CHANGE_PASSWORD, args, cookie, '/profile');

/**
 * A page request as a browser makes it.
 *
 * The Accept and Sec-Fetch-Dest headers matter: the middleware only remembers
 * a `?from=` destination for real navigations, so that a probe or a missing
 * asset cannot become where someone lands after signing in.
 */
async function get(path: string, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'sec-fetch-dest': 'document',
      ...(cookie ? { cookie } : {}),
    },
    redirect: 'manual',
  });
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { phoneNumber: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.authEvent.deleteMany({ where: { subject: { startsWith: TEST_PREFIX } } });
  await prisma.pendingUser.deleteMany({ where: { phoneNumber: { startsWith: TEST_PREFIX } } });
}

async function main() {
  await assertServerMatchesBuild(BASE);
  console.log(`\nAuthentication end-to-end tests against ${BASE}`);

  await cleanup();

  // ---------------------------------------------------------------- fixtures
  const memberRole = await prisma.role.findFirst({ where: { name: 'Member' } });
  if (!memberRole) throw new Error('Expected a "Member" role to exist in this database.');

  const legacyUser = await prisma.user.create({
    data: {
      firstName: 'Legacy',
      lastName: 'Tester',
      name: 'Legacy Tester',
      email: 'legacy.tester@example.invalid',
      phoneNumber: '0700000001',
      // Stored by the old .NET service, not by this system.
      passwordHash: legacyHash(LEGACY_PASSWORD),
      mustChangePassword: false,
      roles: { connect: { id: memberRole.id } },
    },
  });

  const disabledUser = await prisma.user.create({
    data: {
      firstName: 'Disabled',
      lastName: 'Tester',
      name: 'Disabled Tester',
      email: 'disabled.tester@example.invalid',
      phoneNumber: '0700000002',
      passwordHash: legacyHash(LEGACY_PASSWORD),
      isActive: false,
    },
  });

  const lockoutUser = await prisma.user.create({
    data: {
      firstName: 'Lockout',
      lastName: 'Tester',
      name: 'Lockout Tester',
      email: 'lockout.tester@example.invalid',
      phoneNumber: '0700000003',
      passwordHash: legacyHash(LEGACY_PASSWORD),
    },
  });

  await prisma.pendingUser.create({
    data: {
      id: 'test-pending-0000-0000-000000000004',
      firstName: 'Pending',
      lastName: 'Tester',
      email: 'pending.tester@example.invalid',
      phoneNumber: '0700000004',
      passwordHash: legacyHash(LEGACY_PASSWORD),
      mustChangePassword: false,
    },
  });

  // ------------------------------------------------- unauthenticated access
  section('1. Unauthenticated visitors are redirected to this system\'s login page');

  for (const path of ['/dashboard', '/projects', '/settings', '/ceo-report', '/reports', '/payments']) {
    const res = await get(path);
    const location = res.headers.get('location') ?? '';
    check(
      `GET ${path} redirects to /login`,
      (res.status === 307 || res.status === 302) && location.includes('/login'),
      `status ${res.status}, location "${location}"`,
    );
  }

  const loginPage = await get('/login');
  check('GET /login is reachable without a session', loginPage.status === 200, `status ${loginPage.status}`);

  const returnPath = await get('/projects');
  check(
    'the requested path is preserved in ?from= for post-login return',
    (returnPath.headers.get('location') ?? '').includes('from=%2Fprojects'),
    returnPath.headers.get('location') ?? '',
  );

  // ------------------------------------------------------------------ login
  section('2. Sign-in');

  const badPassword = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000001', password: 'WrongPassword1!' },
  ]);
  check('wrong password is rejected', badPassword.text.includes('Incorrect phone number or password'));
  check('wrong password issues no session cookie', badPassword.cookie === null);

  const unknownUser = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0799999999', password: 'Whatever1!' },
  ]);
  check(
    'unknown phone number gives the same message as a wrong password (no account enumeration)',
    unknownUser.text.includes('Incorrect phone number or password'),
  );

  const good = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000001', password: LEGACY_PASSWORD },
  ]);
  check('a password migrated from the legacy service signs in', good.cookie !== null, good.text.slice(0, 200));
  const sessionCookie = good.cookie!;

  const rawSetCookie = good.res.headers.get('set-cookie') ?? '';
  check('session cookie is HttpOnly', /HttpOnly/i.test(rawSetCookie), rawSetCookie);
  check('session cookie is SameSite=Lax', /SameSite=lax/i.test(rawSetCookie), rawSetCookie);

  const storedAfterLogin = await prisma.user.findUnique({ where: { id: legacyUser.id } });
  const upgraded = describeHash(storedAfterLogin!.passwordHash!);
  check(
    'the legacy 100,000-iteration hash was transparently upgraded on sign-in',
    upgraded!.iterations >= 210_000,
    `iterations now ${upgraded?.iterations}`,
  );

  const loginEvent = await prisma.authEvent.findFirst({
    where: { userId: legacyUser.id, type: 'LOGIN_SUCCEEDED' },
  });
  check('the successful sign-in was recorded in the audit trail', loginEvent !== null);

  const failEvent = await prisma.authEvent.findFirst({ where: { subject: '0700000001', type: 'LOGIN_FAILED' } });
  check('the failed sign-in was recorded in the audit trail', failEvent !== null);

  // ------------------------------------------------- authenticated access
  section('3. Authenticated access and per-route permissions');

  const dashboard = await get('/dashboard', sessionCookie);
  check('a signed-in user can open /dashboard', dashboard.status === 200, `status ${dashboard.status}`);

  const dashboardBody = await dashboard.text();
  check('the dashboard renders for the signed-in user', dashboardBody.includes('Projects Dashboard'));

  // The Member role has dashboard:view and projects:read but not reports:view
  // or the settings permissions.
  const settings = await get('/settings', sessionCookie);
  const settingsBody = settings.status === 200 ? await settings.text() : '';
  check(
    'a member without settings permission is refused /settings',
    settings.status !== 200 || settingsBody.includes('do not have access'),
    `status ${settings.status}`,
  );

  const ceoReport = await get('/ceo-report', sessionCookie);
  const ceoBody = ceoReport.status === 200 ? await ceoReport.text() : '';
  check(
    'a member without reports:view is refused /ceo-report',
    ceoReport.status !== 200 || ceoBody.includes('do not have access'),
    `status ${ceoReport.status}`,
  );
  check(
    'the refused report page does not leak portfolio data',
    !ceoBody.includes('Portfolio Overview'),
  );

  const projects = await get('/projects', sessionCookie);
  check('a member with projects:read can open /projects', projects.status === 200, `status ${projects.status}`);

  const loginWhenSignedIn = await get('/login', sessionCookie);
  check(
    'a signed-in user visiting /login is sent to the dashboard',
    (loginWhenSignedIn.headers.get('location') ?? '').includes('/dashboard'),
    loginWhenSignedIn.headers.get('location') ?? `status ${loginWhenSignedIn.status}`,
  );

  // ------------------------------------------------------- forged sessions
  section('4. Session tokens cannot be forged or reused after revocation');

  const forged = await get('/dashboard', 'nibteam_session=' + randomBytes(32).toString('base64url'));
  check(
    'a random session token is rejected',
    (forged.headers.get('location') ?? '').includes('/login'),
    `status ${forged.status}`,
  );

  const dbSession = await prisma.session.findFirst({ where: { userId: legacyUser.id, revokedAt: null } });
  check('the session token is not stored in plaintext',
    dbSession !== null && !sessionCookie.includes(dbSession.tokenHash));

  // ------------------------------------------------------ password change
  section('5. Changing a password ends every existing session');

  const secondLogin = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000001', password: LEGACY_PASSWORD },
  ]);
  const secondCookie = secondLogin.cookie!;
  check('the same account can hold two sessions (two devices)', secondCookie !== null && secondCookie !== sessionCookie);

  await changePassword([{ currentPassword: LEGACY_PASSWORD, newPassword: NEW_PASSWORD }], sessionCookie);

  const afterChange = await prisma.user.findUnique({ where: { id: legacyUser.id } });
  check(
    'the stored password hash changed',
    afterChange!.passwordHash !== storedAfterLogin!.passwordHash,
  );
  check('passwordChangedAt was stamped', afterChange!.passwordChangedAt !== null);

  const afterChangeOwn = await get('/dashboard', sessionCookie);
  check(
    'the session that changed the password is signed out',
    (afterChangeOwn.headers.get('location') ?? '').includes('/login'),
    `status ${afterChangeOwn.status}`,
  );

  const afterChangeOther = await get('/dashboard', secondCookie);
  check(
    'the other device is signed out too',
    (afterChangeOther.headers.get('location') ?? '').includes('/login'),
    `status ${afterChangeOther.status}`,
  );

  const oldPasswordNow = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000001', password: LEGACY_PASSWORD },
  ]);
  check('the old password no longer works', oldPasswordNow.cookie === null);

  const newPasswordNow = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000001', password: NEW_PASSWORD },
  ]);
  check('the new password works', newPasswordNow.cookie !== null);
  const freshCookie = newPasswordNow.cookie!;

  const changeEvent = await prisma.authEvent.findFirst({
    where: { userId: legacyUser.id, type: 'PASSWORD_CHANGED' },
  });
  check('the password change was recorded in the audit trail', changeEvent !== null);

  const wrongCurrent = await changePassword(
    [{ currentPassword: 'NotMyPassword1!', newPassword: 'Another!Pass3' }],
    freshCookie,
  );
  check('a password change with the wrong current password is refused',
    wrongCurrent.text.includes('current password is incorrect'), wrongCurrent.text.slice(0, 200));

  const weakNew = await changePassword(
    [{ currentPassword: NEW_PASSWORD, newPassword: 'weak' }],
    freshCookie,
  );
  check('a password below the policy is refused',
    weakNew.text.includes('at least 8 characters'), weakNew.text.slice(0, 200));

  const stillWorks = await get('/dashboard', freshCookie);
  check('a refused password change leaves the session intact', stillWorks.status === 200,
    `status ${stillWorks.status}`);

  // ------------------------------------------------------------- accounts
  section('6. Disabled accounts, lockout, and migrated first sign-in');

  const disabled = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000002', password: LEGACY_PASSWORD },
  ]);
  check('a disabled account cannot sign in', disabled.cookie === null);
  check('the disabled account is told why', disabled.text.includes('disabled'));

  for (let i = 0; i < 5; i++) {
    await callAction(ACTION_LOGIN, [{ phoneNumber: '0700000003', password: 'Wrong!Pass9' }]);
  }
  const locked = await prisma.user.findUnique({ where: { id: lockoutUser.id } });
  check('five failed attempts lock the account', locked?.lockedUntil !== null && locked!.lockedUntil! > new Date());

  const lockedLogin = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000003', password: LEGACY_PASSWORD },
  ]);
  check('a locked account is refused even with the correct password', lockedLogin.cookie === null);

  const lockEvent = await prisma.authEvent.findFirst({ where: { userId: lockoutUser.id, type: 'ACCOUNT_LOCKED' } });
  check('the lockout was recorded in the audit trail', lockEvent !== null);

  const pendingBefore = await prisma.user.findFirst({ where: { phoneNumber: '0700000004' } });
  check('the migrated account has no local user record yet', pendingBefore === null);

  const pendingLogin = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000004', password: LEGACY_PASSWORD },
  ]);
  check('a migrated account that never used this system can sign in', pendingLogin.cookie !== null,
    pendingLogin.text.slice(0, 200));

  const pendingAfter = await prisma.user.findFirst({ where: { phoneNumber: '0700000004' } });
  check('signing in created their local user record', pendingAfter !== null);
  check('the local record keeps the legacy id, so historical references still resolve',
    pendingAfter?.id === 'test-pending-0000-0000-000000000004');
  const stagedGone = await prisma.pendingUser.findFirst({ where: { phoneNumber: '0700000004' } });
  check('the staging row was consumed', stagedGone === null);

  // ----------------------------------------------------------- expiry etc.
  section('7. Session expiry');

  // The session behind freshCookie is the most recently created live one.
  const active = await prisma.session.findFirst({
    where: { userId: legacyUser.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  await prisma.session.update({
    where: { id: active!.id },
    data: { lastSeenAt: new Date(Date.now() - 20 * 60 * 1000) },
  });
  const idle = await get('/dashboard', freshCookie);
  check(
    'a session idle beyond 15 minutes is rejected',
    (idle.headers.get('location') ?? '').includes('/login'),
    `status ${idle.status}`,
  );
  const idled = await prisma.session.findUnique({ where: { id: active!.id } });
  check('the idle session was marked revoked', idled?.revokedReason === 'IDLE_TIMEOUT');

  const finalLogin = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000001', password: NEW_PASSWORD },
  ]);
  const survivorCookie = finalLogin.cookie!;
  const beforeExpiry = await get('/dashboard', survivorCookie);
  check('a fresh session works', beforeExpiry.status === 200);

  const survivor = await prisma.session.findFirst({
    where: { userId: legacyUser.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  await prisma.session.update({
    where: { id: survivor!.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await get('/dashboard', survivorCookie);
  check(
    'a session past its absolute expiry is rejected',
    (expired.headers.get('location') ?? '').includes('/login'),
    `status ${expired.status}`,
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);

  // Leave one valid session behind for the restart test, which runs separately.
  const keep = await callAction(ACTION_LOGIN, [
    { phoneNumber: '0700000001', password: NEW_PASSWORD },
  ]);
  if (keep.cookie) {
    console.log(`RESTART_COOKIE=${keep.cookie}`);
  }

  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
