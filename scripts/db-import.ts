/**
 * Loads a database exported by `npm run db:export` onto this machine.
 *
 *   npm run db:import -- --file=nibteam.dump
 *   npm run db:import -- --file=nibteam.dump --without-credentials
 *
 * This REPLACES the database named in DATABASE_URL. Everything currently in it
 * is destroyed, so it refuses to run against a database that holds real work
 * unless you pass --force.
 *
 * `--without-credentials` loads the people, roles and projects but clears every
 * password hash. Use it when the machine is less trusted than the one the dump
 * came from: you get realistic data to work with without carrying dozens of
 * colleagues' credentials onto a laptop. Issue yourself a way in afterwards
 * with `npm run auth:reset-admin -- <phone>`.
 */
import { existsSync } from 'fs';
import path from 'path';

import {
  connectionFromEnv,
  findTool,
  maintenanceSql,
  run,
  targetSql,
  type Connection,
} from './lib/pg-tools';

const FORCE = process.argv.includes('--force');
const WITHOUT_CREDENTIALS = process.argv.includes('--without-credentials');

function arg(name: string, fallback: string): string {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

/**
 * Refuses to destroy a database somebody is using.
 *
 * The test is the same one the seed uses: a password hash means real accounts
 * exist here. A database of demo users has none.
 */
function refuseIfInUse(connection: Connection) {
  let inUse: string | null = null;
  try {
    const withPassword = Number(
      targetSql(connection, `SELECT count(*) FROM "User" WHERE "passwordHash" IS NOT NULL`),
    );
    const projects = Number(targetSql(connection, `SELECT count(*) FROM "Project"`));
    if (withPassword > 0) {
      inUse = `${withPassword} account(s) with a password and ${projects} project(s)`;
    }
  } catch {
    // No such database, or no such table. Either way there is nothing to lose.
    return;
  }

  if (!inUse) return;

  if (FORCE) {
    console.warn(`  --force given; replacing a database holding ${inUse}.\n`);
    return;
  }

  console.error(
    [
      '',
      `Refusing to replace "${connection.database}": it is in use.`,
      '',
      `  It holds ${inUse}.`,
      '',
      'Importing drops the database and rebuilds it from the dump, so all of',
      'that would be lost. Export it first if you might want it back:',
      '',
      '  npm run db:export -- --out=before-import.dump',
      '',
      'Then re-run with --force.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

function main() {
  const connection = connectionFromEnv();
  const file = path.resolve(arg('file', 'nibteam.dump'));

  if (!existsSync(file)) {
    throw new Error(
      `No such file: ${file}\n  Pass --file=<path>, or produce one with npm run db:export.`,
    );
  }

  console.log(`\nImporting into ${connection.redacted}`);
  console.log(`  From : ${file}\n`);

  refuseIfInUse(connection);

  // Drop and recreate rather than restoring over the top: pg_restore into a
  // populated database leaves whatever the dump does not mention, which is a
  // confusing half-state rather than a copy.
  const quoted = `"${connection.database.replace(/"/g, '""')}"`;
  console.log('  Replacing the database...');
  // Anything still connected blocks the drop, including a dev server.
  maintenanceSql(
    connection,
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = '${connection.database.replace(/'/g, "''")}' AND pid <> pg_backend_pid()`,
  );
  maintenanceSql(connection, `DROP DATABASE IF EXISTS ${quoted}`);
  maintenanceSql(connection, `CREATE DATABASE ${quoted}`);

  console.log('  Loading...');
  run(
    findTool('pg_restore'),
    [
      '--host', connection.host,
      '--port', connection.port,
      '--username', connection.user,
      '--dbname', connection.database,
      '--no-owner',
      '--no-privileges',
      file,
    ],
    connection,
  );

  if (WITHOUT_CREDENTIALS) {
    console.log('  Clearing credentials...');
    // Sessions go too: a session token outlives the password it was issued
    // against, so leaving them would let someone straight back in.
    targetSql(
      connection,
      `UPDATE "User" SET "passwordHash" = NULL, "mustChangePassword" = true,
                        "failedLoginAttempts" = 0, "lockedUntil" = NULL;
       DELETE FROM "PendingUser";
       DELETE FROM "Session";`,
    );
  }

  const summary = targetSql(
    connection,
    `SELECT (SELECT count(*) FROM "User") || ' users, ' ||
            (SELECT count(*) FROM "User" WHERE "passwordHash" IS NOT NULL) || ' with a password, ' ||
            (SELECT count(*) FROM "_UserRoles") || ' role assignments, ' ||
            (SELECT count(*) FROM "Project") || ' projects, ' ||
            (SELECT count(*) FROM "PendingUser") || ' staged'`,
  );
  const migrations = targetSql(
    connection,
    `SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
  );

  console.log(`\n  Loaded   : ${summary}`);
  console.log(`  Migrations applied : ${migrations}\n`);

  console.log('  Next:');
  console.log('    npx prisma generate');
  console.log('    npm run build');
  if (WITHOUT_CREDENTIALS) {
    console.log('\n  Nobody can sign in yet. Give yourself a way in:');
    console.log('    npm run auth:reset-admin -- <phone-number>');
  }
  console.log('\n  Do not run `prisma db seed` — it would delete everything you just loaded.\n');
}

try {
  main();
} catch (error) {
  console.error(`\n${(error as Error).message}\n`);
  process.exitCode = 1;
}
