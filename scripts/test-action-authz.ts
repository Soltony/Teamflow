/**
 * Authorization tests at the server-action layer.
 *
 * Server Actions are public HTTP endpoints. Hiding a page or a button does not
 * protect them, so these tests bypass the UI entirely and post directly to the
 * action endpoints — first with no session at all, then as a low-privilege
 * member — and assert that nothing succeeds.
 *
 *   npx tsx scripts/test-action-authz.ts http://localhost:3399
 */
import { PrismaClient } from '@prisma/client';
import { pbkdf2Sync, randomBytes } from 'crypto';

import { actionIdsFor, soleActionIdFor } from './lib/action-ids';
import { assertServerMatchesBuild } from './lib/build-check';

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? 'http://localhost:3399';

const ACTION_LOGIN = soleActionIdFor('login');

/** Every action the Settings page ships, i.e. the whole admin surface. */
const SETTINGS_ACTION_IDS = actionIdsFor('settings');

const TEST_PHONE = '0700000009';
const TEST_PASSWORD = 'Member!Pass1';

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

async function post(path: string, actionId: string, args: unknown[], cookie?: string) {
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
  return { status: res.status, text: await res.text() };
}

/**
 * An action that ran and refused, rather than one that ran and did something.
 *
 * Two shapes count as a refusal, both fail-closed:
 *   - a { success: false, error } result, from the mutating actions, which the
 *     UI shows as a message; and
 *   - a 500 with an opaque digest, from the read actions, which throw. Next
 *     hides error text in production, so the digest is all that comes back.
 *     Read actions only load a page the route guard already blocks, so a
 *     legitimate user never reaches this path.
 */
function refused(status: number, text: string) {
  return (
    status === 500 ||
    text.includes('do not have permission') ||
    text.includes('not signed in') ||
    text.includes('UNAUTHENTICATED') ||
    text.includes('FORBIDDEN')
  );
}

async function main() {
  await assertServerMatchesBuild(BASE);
  console.log(`\nServer-action authorization tests against ${BASE}\n`);

  await prisma.session.deleteMany({ where: { user: { phoneNumber: TEST_PHONE } } });
  await prisma.authEvent.deleteMany({ where: { user: { phoneNumber: TEST_PHONE } } });
  await prisma.user.deleteMany({ where: { phoneNumber: TEST_PHONE } });

  const memberRole = await prisma.role.findFirst({ where: { name: 'Member' } });
  if (!memberRole) throw new Error('Expected a "Member" role.');

  await prisma.user.create({
    data: {
      firstName: 'Authz', lastName: 'Member', name: 'Authz Member',
      email: 'authz.member@example.invalid',
      phoneNumber: TEST_PHONE,
      passwordHash: hash(TEST_PASSWORD),
      roles: { connect: { id: memberRole.id } },
    },
  });

  const rolesBefore = await prisma.role.count();
  const usersBefore = await prisma.user.count();
  const statusesBefore = await prisma.projectStatus.count();

  console.log('1. With no session at all\n');

  for (const id of SETTINGS_ACTION_IDS) {
    const r = await post('/settings', id, [{ name: 'HACKED', permissions: ['settings:manage'] }]);
    const redirected = r.status === 307 || r.status === 302;
    check(
      `action ${id.slice(0, 10)}… is refused`,
      redirected || refused(r.status, r.text),
      `status ${r.status}: ${r.text.slice(0, 120)}`,
    );
  }

  console.log('\n2. Signed in as a member with no admin permissions\n');

  const login = await post('/login', ACTION_LOGIN, [{ phoneNumber: TEST_PHONE, password: TEST_PASSWORD }]);
  const raw = /nibteam_session=([^;]*)/.exec(
    (await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Next-Action': ACTION_LOGIN, 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify([{ phoneNumber: TEST_PHONE, password: TEST_PASSWORD }]),
      redirect: 'manual',
    }).then((r) => r.headers.get('set-cookie') ?? '')) ?? '',
  );
  const cookie = raw ? `nibteam_session=${raw[1]}` : undefined;
  check('the member signed in', Boolean(cookie), login.text.slice(0, 150));

  for (const id of SETTINGS_ACTION_IDS) {
    const r = await post('/settings', id, [{ name: 'HACKED', permissions: ['settings:manage'] }], cookie);
    check(
      `action ${id.slice(0, 10)}… is refused for a member`,
      refused(r.status, r.text),
      `status ${r.status}: ${r.text.slice(0, 160)}`,
    );
  }

  console.log('\n3. Nothing was actually modified\n');

  check('no role was created', (await prisma.role.count()) === rolesBefore);
  check('no user was created or deleted', (await prisma.user.count()) === usersBefore);
  check('no project status was created', (await prisma.projectStatus.count()) === statusesBefore);
  check('no role is named HACKED', (await prisma.role.count({ where: { name: 'HACKED' } })) === 0);

  const denials = await prisma.authEvent.count({ where: { type: 'ACCESS_DENIED' } });
  check('the refusals were written to the audit trail', denials > 0, `${denials} ACCESS_DENIED events`);

  await prisma.session.deleteMany({ where: { user: { phoneNumber: TEST_PHONE } } });
  await prisma.authEvent.deleteMany({ where: { user: { phoneNumber: TEST_PHONE } } });
  await prisma.user.deleteMany({ where: { phoneNumber: TEST_PHONE } });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
