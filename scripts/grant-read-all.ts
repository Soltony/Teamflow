/**
 * Grants `projects:read-all` to the roles that already had portfolio-wide
 * visibility through the old inference (projects:read + update + delete).
 *
 * Behaviour is unchanged either way — canSeeAllProjects() still honours the old
 * combination for compatibility — but making it explicit means the next person
 * to edit a role can see what it actually confers, and can grant read-all
 * without also granting delete.
 *
 *   npx tsx scripts/grant-read-all.ts            # dry run
 *   npx tsx scripts/grant-read-all.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });

  const needsGrant = roles.filter((role) => {
    if (role.permissions.includes('projects:read-all')) return false;
    return (
      role.permissions.includes('projects:read') &&
      role.permissions.includes('projects:update') &&
      role.permissions.includes('projects:delete')
    );
  });

  console.log(`\nRoles: ${roles.length}`);
  console.log(`Mode : ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  if (needsGrant.length === 0) {
    console.log('No role relies on the old inference. Nothing to do.\n');
  } else {
    for (const role of needsGrant) {
      console.log(`  ${role.name}  ->  + projects:read-all`);
      if (APPLY) {
        await prisma.role.update({
          where: { id: role.id },
          data: { permissions: [...role.permissions, 'projects:read-all'] },
        });
      }
    }
    console.log(`\n${needsGrant.length} role(s) ${APPLY ? 'updated' : 'would be updated'}.`);
  }

  // Anything already explicit is worth showing, so the picture is complete.
  const explicit = roles.filter((r) => r.permissions.includes('projects:read-all'));
  if (explicit.length) {
    console.log(`\nAlready explicit: ${explicit.map((r) => r.name).join(', ')}`);
  }

  const adminOnly = roles.filter((r) => r.name === 'Admin');
  if (adminOnly.length) {
    console.log('Admin holds every permission implicitly and needs no grant.');
  }

  if (!APPLY) console.log('\nDry run — nothing written. Re-run with --apply.\n');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
