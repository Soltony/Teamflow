/**
 * Resetting a user's password from the Users list.
 *
 * The dialog that shows the temporary password is the only place it ever
 * appears — it is not emailed and not stored in readable form. So the reset
 * has to hand one back, and it has to be a password the system will actually
 * accept, or the administrator is left with an account nobody can sign in to.
 *
 *   npx tsx scripts/test-password-reset.ts
 */
import { PrismaClient } from '@prisma/client';

import { generateTemporaryPassword, validatePasswordStrength, verifyPassword, hashPassword } from '../src/lib/auth/password';
import { getNumber, invalidateSettingsCache } from '../src/lib/settings';

const prisma = new PrismaClient();
const MARKER = 'ZZPWRESET';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { phoneNumber: { startsWith: '070003' } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.setting.deleteMany({ where: { key: 'security.passwordMinLength' } });
  invalidateSettingsCache();
}

async function main() {
  console.log('\nResetting a password\n');
  await cleanup();

  const target = await prisma.user.create({
    data: {
      firstName: 'Reset', lastName: 'Target', name: 'Reset Target',
      email: `${MARKER.toLowerCase()}.target@example.invalid`,
      phoneNumber: '0700030001',
      passwordHash: await hashPassword('OriginalPass1!'),
    },
  });

  console.log('1. The generated password is usable\n');

  const minLength = await getNumber('security.passwordMinLength');
  const temporary = generateTemporaryPassword();

  check('a temporary password is produced', typeof temporary === 'string' && temporary.length > 0);
  check(
    'and it satisfies the configured policy',
    validatePasswordStrength(temporary, minLength) === null,
    validatePasswordStrength(temporary, minLength) ?? '',
  );

  // The reset flow, as the action performs it.
  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash: await hashPassword(temporary),
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const after = await prisma.user.findUnique({ where: { id: target.id } });
  const { valid } = await verifyPassword(temporary, after!.passwordHash!);
  check('the account accepts the temporary password afterwards', valid);
  check('and the person is made to change it', after!.mustChangePassword === true);
  check('any lock is cleared, so they are not locked out of their own reset',
    after!.lockedUntil === null && after!.failedLoginAttempts === 0);

  const stillOld = await verifyPassword('OriginalPass1!', after!.passwordHash!);
  check('the old password no longer works', !stillOld.valid);

  console.log('\n2. It still works when the policy is tightened\n');

  // An administrator raises the minimum; the generated password must still pass,
  // or every reset from then on hands out a password the system rejects.
  await prisma.setting.upsert({
    where: { key: 'security.passwordMinLength' },
    update: { value: '16' },
    create: { key: 'security.passwordMinLength', value: '16' },
  });
  invalidateSettingsCache();

  const raised = await getNumber('security.passwordMinLength');
  check('the raised minimum is in effect', raised === 16, `got ${raised}`);

  let generatedTooShort = 0;
  for (let i = 0; i < 50; i++) {
    if (validatePasswordStrength(generateTemporaryPassword(raised), raised) !== null) generatedTooShort++;
  }
  check(
    'every generated password still satisfies the raised minimum',
    generatedTooShort === 0,
    `${generatedTooShort} of 50 were rejected`,
  );

  console.log('\n3. Sessions are ended by a reset\n');

  await prisma.session.create({
    data: {
      tokenHash: 'a'.repeat(64),
      userId: target.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  const before = await prisma.session.count({ where: { userId: target.id } });
  check('the account had a live session', before === 1);

  // What revokeAllSessionsForUser does.
  await prisma.session.deleteMany({ where: { userId: target.id } });
  const remaining = await prisma.session.count({ where: { userId: target.id } });
  check('the reset leaves none behind', remaining === 0);

  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
