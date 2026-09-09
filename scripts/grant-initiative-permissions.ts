/**
 * Grants the `initiatives:*` permissions to the roles that already administer
 * departments.
 *
 * Initiatives are maintained exactly as departments are — their own section,
 * their own CRUD permissions — but the permissions are new, so no existing role
 * holds them and nobody can open /initiatives until they are granted. Roles
 * saved before a permission existed cannot know about it; this backfills them
 * from the equivalent department grant rather than asking somebody to tick
 * twenty-eight boxes by hand.
 *
 * A role gets each initiative permission only where it already holds the
 * matching department one, so a role that may read departments but not delete
 * them ends up able to read initiatives but not delete them either. Idempotent:
 * running it twice grants nothing the second time.
 *
 *   npx tsx scripts/grant-initiative-permissions.ts            # dry run
 *   npx tsx scripts/grant-initiative-permissions.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/** Each initiative permission and the department one that earns it. */
const MIRRORED: Array<[departmentPermission: string, initiativePermission: string]> = [
  ['departments:read', 'initiatives:read'],
  ['departments:create', 'initiatives:create'],
  ['departments:update', 'initiatives:update'],
  ['departments:delete', 'initiatives:delete'],
];

async function main() {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });

  console.log(`\nRoles: ${roles.length}`);
  console.log(`Mode : ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  let changed = 0;

  for (const role of roles) {
    const held = new Set(role.permissions);
    const toGrant = MIRRORED
      .filter(([department, initiative]) => held.has(department) && !held.has(initiative))
      .map(([, initiative]) => initiative);

    if (toGrant.length === 0) continue;

    console.log(`  ${role.name}  ->  + ${toGrant.join(', ')}`);
    if (APPLY) {
      await prisma.role.update({
        where: { id: role.id },
        data: { permissions: [...role.permissions, ...toGrant] },
      });
    }
    changed += 1;
  }

  if (changed === 0) {
    console.log('Every role that administers departments already administers initiatives.\n');
  } else {
    console.log(`\n${changed} role(s) ${APPLY ? 'updated' : 'would be updated'}.`);
    if (!APPLY) console.log('Re-run with --apply to make the change.\n');
    else console.log('');
  }

  // Roles nobody can grant this way are worth naming: an organisation may well
  // want an initiative owner who has no business editing departments, and that
  // grant has to be made by hand in Settings → Roles.
  const withoutAny = roles.filter(
    (r) => !r.permissions.some((p) => p.startsWith('initiatives:')) &&
           !r.permissions.includes('departments:read'),
  );
  if (withoutAny.length) {
    console.log(
      `Untouched (no department permissions to mirror): ${withoutAny.map((r) => r.name).join(', ')}\n`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
