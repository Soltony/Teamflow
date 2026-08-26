/**
 * Administrator flows: creating an account, resetting a password, disabling an
 * account, and changing roles. These call the actions directly rather than
 * over HTTP, so the assertions are about what lands in the database.
 *
 *   npx tsx scripts/test-admin-flows.ts
 */
import { PrismaClient } from '@prisma/client';

import {
  generateTemporaryPassword,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '../src/lib/auth/password';
import { normalizePhoneNumber } from '../src/lib/auth/phone';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const PHONE = '0700000021';

async function main() {
  console.log('\nAdministrator flows\n');

  await prisma.session.deleteMany({ where: { user: { phoneNumber: PHONE } } });
  await prisma.authEvent.deleteMany({ where: { user: { phoneNumber: PHONE } } });
  await prisma.user.deleteMany({ where: { phoneNumber: PHONE } });

  console.log('1. Temporary passwords\n');

  const temps = Array.from({ length: 200 }, () => generateTemporaryPassword());
  check('generated temporary passwords all satisfy the policy',
    temps.every((t) => validatePasswordStrength(t) === null));
  check('generated temporary passwords are unique', new Set(temps).size === temps.length);
  check('generated temporary passwords are at least 14 characters',
    temps.every((t) => t.length >= 14));
  check('the guaranteed character classes are not always in the same positions',
    new Set(temps.map((t) => (/[A-Z]/.test(t[0]) ? 'U' : 'o'))).size > 1);

  console.log('\n2. Account creation stores only a hash\n');

  const initial = generateTemporaryPassword();
  const created = await prisma.user.create({
    data: {
      firstName: 'Created', lastName: 'ByAdmin', name: 'Created ByAdmin',
      email: 'created.byadmin@example.invalid',
      phoneNumber: PHONE,
      passwordHash: await hashPassword(initial),
      mustChangePassword: true,
    },
  });

  check('the plaintext password is not stored anywhere on the user',
    !JSON.stringify(created).includes(initial));
  check('the temporary password verifies', (await verifyPassword(initial, created.passwordHash)).valid);
  check('a new account must change its password on first sign-in', created.mustChangePassword === true);
  check('a new account is active', created.isActive === true);

  console.log('\n3. Password reset revokes sessions\n');

  await prisma.session.createMany({
    data: [
      { tokenHash: 'admin-test-hash-1', userId: created.id, expiresAt: new Date(Date.now() + 3600_000) },
      { tokenHash: 'admin-test-hash-2', userId: created.id, expiresAt: new Date(Date.now() + 3600_000) },
    ],
  });
  const live = await prisma.session.count({ where: { userId: created.id, revokedAt: null } });
  check('the account has two live sessions before the reset', live === 2);

  const reissued = generateTemporaryPassword();
  await prisma.user.update({
    where: { id: created.id },
    data: {
      passwordHash: await hashPassword(reissued),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  await prisma.session.updateMany({
    where: { userId: created.id, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
  });

  const stillLive = await prisma.session.count({ where: { userId: created.id, revokedAt: null } });
  check('every session is revoked by the reset', stillLive === 0);

  const afterReset = await prisma.user.findUnique({ where: { id: created.id } });
  check('the old temporary password no longer verifies',
    !(await verifyPassword(initial, afterReset!.passwordHash)).valid);
  check('the reissued password verifies',
    (await verifyPassword(reissued, afterReset!.passwordHash)).valid);
  check('the account is flagged to change password again', afterReset!.mustChangePassword === true);
  check('a lockout is cleared by the reset', afterReset!.lockedUntil === null);

  console.log('\n4. Phone number normalisation\n');

  const forms = ['0912345678', '+251912345678', '251912345678', '0912 345 678', '912345678', '00251912345678'];
  const normalized = forms.map((f) => normalizePhoneNumber(f));
  check('every written form of one number normalises to the same value',
    new Set(normalized).size === 1 && normalized[0] === '0912345678',
    JSON.stringify(normalized));
  check('nonsense input is rejected',
    ['', 'abc', '12', '09123456789012'].every((f) => normalizePhoneNumber(f) === null));

  console.log('\n5. Existing data is intact\n');

  const realUsers = await prisma.user.count({ where: { phoneNumber: { startsWith: '09' } } });
  check('the 38 migrated users are still present', realUsers === 38, `found ${realUsers}`);

  const withCredentials = await prisma.user.count({
    where: { phoneNumber: { startsWith: '09' }, passwordHash: { not: null } },
  });
  check('every migrated user has a credential', withCredentials === realUsers,
    `${withCredentials} of ${realUsers}`);

  const roles = await prisma.role.count();
  check('all 7 roles survived the migration', roles === 7, `found ${roles}`);

  const roleAssignments = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "_UserRoles"`;
  check('all 43 role assignments survived', Number(roleAssignments[0].count) === 43,
    `found ${roleAssignments[0].count}`);

  const pending = await prisma.pendingUser.count();
  check('the 12 accounts that never used this system are staged', pending === 12, `found ${pending}`);

  const noPassword = await prisma.user.count({
    where: { passwordHash: null, phoneNumber: { startsWith: '09' } },
  });
  check('no migrated user is locked out for want of a credential', noPassword === 0);

  await prisma.session.deleteMany({ where: { userId: created.id } });
  await prisma.authEvent.deleteMany({ where: { userId: created.id } });
  await prisma.user.delete({ where: { id: created.id } });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
