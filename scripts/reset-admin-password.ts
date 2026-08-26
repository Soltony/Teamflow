/**
 * Last-resort password reset, run on the server.
 *
 * For the one situation the Settings screen cannot help with: no administrator
 * can sign in, so nobody can reset anybody. It needs shell access to the
 * application server and the production DATABASE_URL, which is the only
 * authorisation it can meaningfully check.
 *
 *   npx tsx scripts/reset-admin-password.ts 0912345678
 *
 * It prints a temporary password once. The account is required to change it at
 * next sign-in, and every existing session for it is revoked.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

import { generateTemporaryPassword, hashPassword } from '../src/lib/auth/password';
import { normalizePhoneNumber } from '../src/lib/auth/phone';

const prisma = new PrismaClient();

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('\nUsage: npx tsx scripts/reset-admin-password.ts <phone-number>\n');
    console.error('Accounts that can be reset:\n');
    const admins = await prisma.user.findMany({
      where: { roles: { some: { name: 'Admin' } } },
      select: { name: true, phoneNumber: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    for (const a of admins) {
      console.error(`  ${a.phoneNumber}  ${a.name}${a.isActive ? '' : '  (disabled)'}`);
    }
    console.error('');
    process.exitCode = 1;
    return;
  }

  const phoneNumber = normalizePhoneNumber(input);
  if (!phoneNumber) {
    console.error(`\n"${input}" is not a phone number this system recognises.\n`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { id: true, name: true, email: true, isActive: true, roles: { select: { name: true } } },
  });

  if (!user) {
    console.error(`\nNo account with phone number ${phoneNumber}.\n`);
    process.exitCode = 1;
    return;
  }

  // Read the configured minimum directly rather than through the settings
  // cache, so this works even if the settings table is unreadable.
  const row = await prisma.setting
    .findUnique({ where: { key: 'security.passwordMinLength' } })
    .catch(() => null);
  const minLength = Math.max(8, Math.min(Number(row?.value) || 8, 64));

  const temporaryPassword = generateTemporaryPassword(minLength);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      // An account nobody could sign in to may also have been disabled.
      isActive: true,
    },
  });

  const revoked = await prisma.session.deleteMany({ where: { userId: user.id } });

  // Recorded like any other reset. A break-glass action is exactly the kind
  // that should be visible afterwards.
  await prisma.authEvent
    .create({
      data: {
        type: 'PASSWORD_RESET',
        userId: user.id,
        detail:
          `Password reset from the server console for ${user.email}; ` +
          `${revoked.count} session(s) revoked.`,
      },
    })
    .catch(() => undefined);

  console.log(`\n  Account   ${user.name} (${user.email})`);
  console.log(`  Roles     ${user.roles.map((r) => r.name).join(', ') || 'none'}`);
  console.log(`  Sessions  ${revoked.count} revoked`);
  console.log(`\n  Temporary password:  ${temporaryPassword}\n`);
  console.log('  Shown once. They must change it at next sign-in.');
  console.log('  Clear your shell history if it is recorded.\n');

  if (!user.roles.some((r) => r.name === 'Admin')) {
    console.log('  Note: this account is not an administrator.\n');
  }
}

main()
  .catch((e) => {
    console.error('\nCould not reset the password:', e.message, '\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
