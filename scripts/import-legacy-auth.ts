/**
 * Imports credentials from the legacy TeamAuthDb into this system.
 *
 *   npx tsx scripts/import-legacy-auth.ts            # dry run, prints the plan
 *   npx tsx scripts/import-legacy-auth.ts --apply    # writes
 *   npx tsx scripts/import-legacy-auth.ts --apply --force
 *
 * Reads scripts/data/legacy-auth-users.json, produced by
 * scripts/extract-auth-dump.mjs from the pg_dump backup.
 *
 * Behaviour:
 *   - Matches a legacy account to a local User by id, then email, then phone.
 *     The ids are the same in both systems, because the old application used
 *     the identity provider's user id as the local primary key.
 *   - Copies the password hash and the "must change password" flag. Nothing
 *     else about the user is touched: names, roles, divisions, and every
 *     project relationship stay exactly as they are.
 *   - Legacy accounts with no local User are staged in PendingUser. Their User
 *     record is created the first time they sign in, which is what the old
 *     syncUser did.
 *   - Idempotent. Without --force it will not overwrite a password that has
 *     already been set in this system, so re-running cannot undo a change a
 *     user has since made.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

import { describeHash } from '../src/lib/auth/password';
import { normalizePhoneNumber } from '../src/lib/auth/phone';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

interface LegacyUser {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  mustChangePassword: boolean;
  email: string;
  passwordHash: string;
  legacyRoles: string[];
}

type Outcome =
  | { kind: 'linked'; legacy: LegacyUser; localId: string; matchedBy: string }
  | { kind: 'skipped-has-password'; legacy: LegacyUser; localId: string }
  | { kind: 'staged'; legacy: LegacyUser }
  | { kind: 'staged-already'; legacy: LegacyUser }
  | { kind: 'rejected'; legacy: LegacyUser; reason: string };

async function main() {
  const dataPath = path.join(__dirname, 'data', 'legacy-auth-users.json');
  const payload = JSON.parse(readFileSync(dataPath, 'utf8')) as {
    source: string;
    users: LegacyUser[];
  };

  console.log(`\nLegacy source : ${payload.source}`);
  console.log(`Accounts      : ${payload.users.length}`);
  console.log(`Mode          : ${APPLY ? (FORCE ? 'APPLY (force overwrite)' : 'APPLY') : 'DRY RUN'}\n`);

  const outcomes: Outcome[] = [];

  for (const legacy of payload.users) {
    if (!legacy.passwordHash || !describeHash(legacy.passwordHash)) {
      outcomes.push({ kind: 'rejected', legacy, reason: 'unreadable password hash' });
      continue;
    }
    const phone = normalizePhoneNumber(legacy.phoneNumber);
    if (!phone) {
      outcomes.push({ kind: 'rejected', legacy, reason: `unusable phone "${legacy.phoneNumber}"` });
      continue;
    }
    const email = legacy.email?.trim().toLowerCase();
    if (!email) {
      outcomes.push({ kind: 'rejected', legacy, reason: 'no email address' });
      continue;
    }

    // Match by id first: the two systems share the identity provider's id.
    let local = await prisma.user.findUnique({ where: { id: legacy.id } });
    let matchedBy = 'id';

    if (!local) {
      local = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
      matchedBy = 'email';
    }
    if (!local) {
      local = await prisma.user.findFirst({ where: { phoneNumber: phone } });
      matchedBy = 'phone';
    }

    if (local) {
      if (local.passwordHash && !FORCE) {
        outcomes.push({ kind: 'skipped-has-password', legacy, localId: local.id });
        continue;
      }
      if (APPLY) {
        await prisma.user.update({
          where: { id: local.id },
          data: {
            passwordHash: legacy.passwordHash,
            mustChangePassword: legacy.mustChangePassword,
            // Normalise the stored number so sign-in lookups always match.
            phoneNumber: phone,
          },
        });
      }
      outcomes.push({ kind: 'linked', legacy, localId: local.id, matchedBy });
      continue;
    }

    const alreadyStaged = await prisma.pendingUser.findFirst({
      where: { OR: [{ id: legacy.id }, { email }, { phoneNumber: phone }] },
    });
    if (alreadyStaged && !FORCE) {
      outcomes.push({ kind: 'staged-already', legacy });
      continue;
    }

    if (APPLY) {
      await prisma.pendingUser.upsert({
        where: { id: legacy.id },
        update: {
          firstName: legacy.firstName,
          lastName: legacy.lastName,
          email,
          phoneNumber: phone,
          passwordHash: legacy.passwordHash,
          mustChangePassword: legacy.mustChangePassword,
        },
        create: {
          id: legacy.id,
          firstName: legacy.firstName,
          lastName: legacy.lastName,
          email,
          phoneNumber: phone,
          passwordHash: legacy.passwordHash,
          mustChangePassword: legacy.mustChangePassword,
        },
      });
    }
    outcomes.push({ kind: 'staged', legacy });
  }

  const by = (kind: Outcome['kind']) => outcomes.filter((o) => o.kind === kind);

  const linked = by('linked') as Extract<Outcome, { kind: 'linked' }>[];
  console.log(`Credentials linked to existing users : ${linked.length}`);
  const byMatch = linked.reduce<Record<string, number>>((acc, o) => {
    acc[o.matchedBy] = (acc[o.matchedBy] ?? 0) + 1;
    return acc;
  }, {});
  for (const [k, v] of Object.entries(byMatch)) console.log(`    matched by ${k.padEnd(6)}: ${v}`);

  console.log(`Staged for first sign-in             : ${by('staged').length}`);
  console.log(`Already staged (unchanged)           : ${by('staged-already').length}`);
  console.log(`Skipped, password already set here   : ${by('skipped-has-password').length}`);
  console.log(`Rejected                             : ${by('rejected').length}`);

  for (const o of by('rejected') as Extract<Outcome, { kind: 'rejected' }>[]) {
    console.log(`    ! ${o.legacy.email || o.legacy.id}: ${o.reason}`);
  }

  // Anyone in this system with no credential at all cannot sign in; surface
  // them so an administrator can issue a password rather than discovering it
  // from a support call.
  const orphans = await prisma.user.findMany({
    where: { passwordHash: null },
    select: { id: true, name: true, email: true },
  });
  if (orphans.length) {
    console.log(`\nLocal users with no password (cannot sign in): ${orphans.length}`);
    for (const u of orphans) console.log(`    - ${u.name} <${u.email}>`);
    console.log('  Use Settings > Users > Reset password to issue a temporary password.');
  } else {
    console.log('\nEvery local user has a credential.');
  }

  if (!APPLY) {
    console.log('\nDry run — nothing was written. Re-run with --apply to commit.\n');
  } else {
    console.log('\nDone.\n');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
