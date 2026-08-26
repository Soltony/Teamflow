/**
 * Creates the single account that scripts/test-restart-persistence.sh signs in
 * with. Kept separate so the shell test does not need a database client.
 *
 *   npx tsx scripts/seed-restart-test-user.ts
 */
import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();
const PHONE = '0700000031';
const PASSWORD = 'Restart!Pass1';

async function main() {
  await prisma.session.deleteMany({ where: { user: { phoneNumber: PHONE } } });
  await prisma.authEvent.deleteMany({ where: { user: { phoneNumber: PHONE } } });
  await prisma.user.deleteMany({ where: { phoneNumber: PHONE } });

  const memberRole = await prisma.role.findFirst({ where: { name: 'Member' } });
  if (!memberRole) throw new Error('Expected a "Member" role to exist.');

  const user = await prisma.user.create({
    data: {
      firstName: 'Restart',
      lastName: 'Tester',
      name: 'Restart Tester',
      email: 'restart.tester@example.invalid',
      phoneNumber: PHONE,
      passwordHash: await hashPassword(PASSWORD),
      roles: { connect: { id: memberRole.id } },
    },
  });

  console.log(`Created ${user.name} <${PHONE}> for the restart test.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
