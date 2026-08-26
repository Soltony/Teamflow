/**
 * Removes the 07xxxxxxxx accounts the auth test scripts create.
 *
 * The end-to-end test deliberately leaves one signed-in account behind so the
 * "session survives a restart" check can run against a restarted server; this
 * clears it afterwards.
 *
 *   npx tsx scripts/cleanup-test-accounts.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_PREFIX = '070000';

async function main() {
  const users = await prisma.user.findMany({
    where: { phoneNumber: { startsWith: TEST_PREFIX } },
    select: { id: true, name: true, phoneNumber: true },
  });

  if (!users.length) {
    console.log('No test accounts found.');
  } else {
    const ids = users.map((u) => u.id);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    for (const u of users) console.log(`removed ${u.name} <${u.phoneNumber}>`);
  }

  const events = await prisma.authEvent.deleteMany({
    where: { subject: { startsWith: TEST_PREFIX } },
  });
  const staged = await prisma.pendingUser.deleteMany({
    where: { phoneNumber: { startsWith: TEST_PREFIX } },
  });
  console.log(`removed ${events.count} test auth events and ${staged.count} staged rows`);

  const remaining = await prisma.user.count();
  const assignments = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "_UserRoles"`;
  console.log(`\n${remaining} users and ${assignments[0].count} role assignments remain.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
