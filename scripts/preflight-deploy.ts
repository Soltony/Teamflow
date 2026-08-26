/**
 * Checks a database is ready for this release, without changing anything.
 *
 * Safe to run against production, and worth running twice: once days before,
 * once immediately before the migration window. Every query is a SELECT.
 *
 * It exists because several migrations in this release move live data, and one
 * of them is irreversible: `20260823030000_reusable_teams` copies each team's
 * project into a new `ProjectTeam` table and then drops `Team.projectId`. If
 * that copy is wrong, the association is gone and only a backup brings it back.
 *
 * Deliberately uses raw SQL rather than the Prisma client: the client is
 * generated from the *new* schema, so querying a database that has not been
 * migrated yet would fail on columns that do not exist.
 *
 *   DATABASE_URL="postgresql://..." npx tsx scripts/preflight-deploy.ts
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, accessSync, constants } from 'fs';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

let problems = 0;
let warnings = 0;

function ok(message: string) {
  console.log(`  OK    ${message}`);
}
function warn(message: string) {
  warnings++;
  console.log(`  WARN  ${message}`);
}
function fail(message: string) {
  problems++;
  console.log(`  BLOCK ${message}`);
}

async function q<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql);
}

/** Whether a table exists, so checks can skip what is not there yet. */
async function tableExists(name: string): Promise<boolean> {
  const rows = await q<{ n: bigint }>(
    `SELECT count(*) AS n FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${name}'`,
  );
  return Number(rows[0].n) > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await q<{ n: bigint }>(
    `SELECT count(*) AS n FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`,
  );
  return Number(rows[0].n) > 0;
}

async function count(table: string, where = ''): Promise<number> {
  const rows = await q<{ n: bigint }>(
    `SELECT count(*) AS n FROM "${table}" ${where ? `WHERE ${where}` : ''}`,
  );
  return Number(rows[0].n);
}

async function main() {
  const target = (process.env.DATABASE_URL || '').replace(/:[^:@/]*@/, ':***@');
  console.log(`\nPreflight for ${target}\n`);

  // ------------------------------------------------------------ connection
  console.log('1. Server\n');
  const version = await q<{ v: string }>('SELECT version() AS v');
  const major = Number(/PostgreSQL (\d+)/.exec(version[0].v)?.[1] ?? 0);
  if (major >= 13) ok(`PostgreSQL ${major}`);
  else fail(`PostgreSQL ${major}: the enum migrations need 13 or newer.`);

  // --------------------------------------------------------- migrations
  console.log('\n2. Migrations\n');

  const haveHistory = await tableExists('_prisma_migrations');
  const applied = new Set<string>();
  if (haveHistory) {
    const rows = await q<{ migration_name: string; finished_at: Date | null }>(
      `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at`,
    );
    for (const r of rows) {
      if (r.finished_at) applied.add(r.migration_name);
      else fail(`Migration "${r.migration_name}" is recorded but unfinished. Resolve it before deploying.`);
    }
    ok(`${applied.size} migration(s) already applied`);
  } else {
    warn('No _prisma_migrations table: this database has never been migrated by Prisma.');
  }

  const onDisk = readdirSync('prisma/migrations')
    .filter((d) => d !== 'migration_lock.toml')
    .sort();
  const pending = onDisk.filter((m) => !applied.has(m));

  if (pending.length === 0) {
    ok('Nothing pending — this database is already at this release.');
  } else {
    console.log(`\n  ${pending.length} pending:`);
    for (const m of pending) console.log(`    - ${m}`);
  }

  const willRun = (name: string) => pending.some((p) => p.includes(name));

  // ------------------------------------------------- enum conversions
  console.log('\n3. Values the enum conversion has to accept\n');

  if (!willRun('indexes_enums_cascades')) {
    ok('Already applied; nothing to check.');
  } else {
    // The members are read out of the migration that creates them rather than
    // restated here. Writing them from memory got two of the four wrong, which
    // is the worst kind of check: it raises a false alarm on a good value and
    // waves through a bad one.
    const migrationSql = readFileSync(
      'prisma/migrations/20260822030000_indexes_enums_cascades/migration.sql',
      'utf8',
    );
    // Plain string search rather than a regular expression: the members sit
    // between the parentheses of the CREATE TYPE that makes the enum.
    const enumMembers = (typeName: string): string[] => {
      const marker = `CREATE TYPE "${typeName}" AS ENUM (`;
      const at = migrationSql.indexOf(marker);
      if (at === -1) return [];
      const close = migrationSql.indexOf(')', at);
      if (close === -1) return [];
      return migrationSql
        .slice(at + marker.length, close)
        .split(',')
        .map((part) => part.trim().replace(/^'|'$/g, ''))
        .filter(Boolean);
    };

    const casts: Array<[string, string, string]> = [
      ['Task', 'status', 'TaskStatus'],
      ['TaskUpdate', 'type', 'TaskUpdateType'],
      ['Blocker', 'status', 'BlockerStatus'],
      ['Payment', 'status', 'PaymentStatus'],
    ];

    for (const [table, column, typeName] of casts) {
      const members = enumMembers(typeName);
      if (members.length === 0) {
        fail(`Could not read the members of ${typeName} from the migration.`);
        continue;
      }
      if (!(await tableExists(table))) { warn(`${table} does not exist; skipped.`); continue; }
      const list = members.map((m) => "'" + m + "'").join(', ');
      const rows = await q<{ value: string; n: bigint }>(
        `SELECT upper(replace(trim("${column}"::text), ' ', '_')) AS value, count(*) AS n
         FROM "${table}"
         WHERE upper(replace(trim("${column}"::text), ' ', '_')) NOT IN (${list})
         GROUP BY 1 ORDER BY 2 DESC`,
      );
      if (rows.length === 0) {
        ok(`${table}.${column}: every value converts to ${typeName}`);
      } else {
        for (const r of rows) {
          fail(
            `${table}.${column}: ${r.n} row(s) hold "${r.value}", which is not one of ` +
              `${members.join(', ')}. The migration will abort. Correct these rows first.`,
          );
        }
      }
    }  }

  // ------------------------------------------------------ team rebuild
  console.log('\n4. Teams (the irreversible step)\n');

  if (!willRun('reusable_teams')) {
    ok('Already applied; nothing to check.');
  } else if (!(await tableExists('Team'))) {
    warn('No Team table; skipped.');
  } else if (!(await columnExists('Team', 'projectId'))) {
    warn('Team.projectId is already gone — was this migration applied outside Prisma?');
  } else {
    const teams = await count('Team');
    const orphans = await q<{ n: bigint }>(
      `SELECT count(*) AS n FROM "Team" t
       LEFT JOIN "Project" p ON p.id = t."projectId"
       WHERE t."projectId" IS NOT NULL AND p.id IS NULL`,
    );
    const nullProject = await count('Team', '"projectId" IS NULL');

    ok(`${teams} team(s) will be copied into ProjectTeam`);
    if (Number(orphans[0].n) > 0) {
      fail(`${orphans[0].n} team(s) point at a project that does not exist; the copy would lose them.`);
    } else {
      ok('every team points at a real project');
    }
    if (nullProject > 0) {
      warn(`${nullProject} team(s) have no project and will end up linked to none.`);
    }
    console.log(`\n  After migrating, "ProjectTeam" should hold ${teams - nullProject} row(s).`);
  }

  // -------------------------------------------------------- issue register
  console.log('\n5. Issues\n');

  if (!willRun('issue_register')) {
    ok('Already applied; nothing to check.');
  } else if (!(await tableExists('Blocker'))) {
    warn('No Blocker table; skipped.');
  } else {
    const blockers = await count('Blocker');
    const blank = await count('Blocker', `coalesce(trim("description"), '') = ''`);
    ok(`${blockers} issue(s) will get a title backfilled from their description`);
    if (blank > 0) {
      warn(`${blank} have no description and will be titled "Untitled issue".`);
    }
  }

  // ------------------------------------------------------------- sign-in
  console.log('\n6. Sign-in readiness\n');

  if (!(await columnExists('User', 'passwordHash'))) {
    warn('User.passwordHash does not exist yet — this deploy includes the authentication cutover.');
    warn('Every user needs a password provisioned before they can sign in. See docs/authentication.md.');
  } else {
    const users = await count('User');
    const noPassword = await count('User', '"passwordHash" IS NULL');
    const inactive = (await columnExists('User', 'isActive'))
      ? await count('User', '"isActive" = false')
      : 0;

    ok(`${users} user account(s)`);
    if (noPassword > 0) {
      warn(`${noPassword} have no password set and cannot sign in until one is issued.`);
    } else {
      ok('every account has a password');
    }
    if (inactive > 0) ok(`${inactive} account(s) are disabled (expected if deliberate)`);

    const admins = await q<{ n: bigint }>(
      `SELECT count(DISTINCT u.id) AS n FROM "User" u
       JOIN "_UserRoles" ur ON ur."B" = u.id
       JOIN "Role" r ON r.id = ur."A"
       WHERE r.name = 'Admin'${(await columnExists('User', 'isActive')) ? ' AND u."isActive" = true' : ''}`,
    ).catch(() => [{ n: BigInt(-1) }]);

    const adminCount = Number(admins[0].n);
    if (adminCount < 0) warn('Could not count administrators; check the role join table name.');
    else if (adminCount === 0) fail('No active administrator. You would be locked out of Settings after deploying.');
    else ok(`${adminCount} active administrator(s)`);
  }

  // ------------------------------------------------------------- storage
  console.log('\n7. Document storage\n');

  const root = process.env.DOCUMENT_STORAGE_ROOT;
  if (!root) {
    warn('DOCUMENT_STORAGE_ROOT is not set. It defaults to a folder inside the application');
    warn('directory, which a deployment that replaces that directory will erase. Set it.');
  } else if (!existsSync(root)) {
    fail(`DOCUMENT_STORAGE_ROOT is "${root}", which does not exist. Create it before deploying.`);
  } else {
    try {
      accessSync(root, constants.W_OK);
      ok(`${root} exists and is writable`);
    } catch {
      fail(`${root} exists but is not writable by this user.`);
    }
    if (path.resolve(root).includes(`${path.sep}public${path.sep}`)) {
      fail('Storage is under public/, where files are served with no authorization check.');
    }
  }

  if (await tableExists('DocumentVersion')) {
    const versions = await count('DocumentVersion');
    if (versions > 0) {
      ok(`${versions} stored file(s) already exist — their bytes must be preserved by this deploy`);
    }
  }

  // -------------------------------------------------------------- summary
  console.log('\n' + '-'.repeat(60));
  const counts: string[] = [];
  for (const t of ['Project', 'Task', 'Milestone', 'Team', 'User', 'Blocker', 'Payment']) {
    if (await tableExists(t)) counts.push(`${t}=${await count(t)}`);
  }
  console.log(`Row counts before deploying: ${counts.join('  ')}`);
  console.log('Record these. Compare them afterwards — the migrations move data but must not lose any.');

  console.log('-'.repeat(60));
  if (problems > 0) {
    console.log(`\n${problems} blocking problem(s), ${warnings} warning(s). Do not deploy yet.\n`);
    process.exitCode = 1;
  } else if (warnings > 0) {
    console.log(`\nNo blocking problems, ${warnings} warning(s) to read before deploying.\n`);
  } else {
    console.log('\nReady to deploy.\n');
  }
}

main()
  .catch((e) => {
    console.error('\nPreflight could not complete:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
