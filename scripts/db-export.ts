/**
 * Copies this machine's database to a file, so another machine can load it.
 *
 *   npm run db:export
 *   npm run db:export -- --out=nibteam.dump
 *
 * The file carries everything: users, their password hashes, roles, projects,
 * documents metadata and the migration history. Load it with `npm run db:import`.
 *
 * It contains real credentials. Treat it as a secret: copy it over something
 * you trust and delete it once it has been loaded.
 */
import { statSync } from 'fs';
import path from 'path';

import { connectionFromEnv, findTool, run, targetSql } from './lib/pg-tools';

function arg(name: string, fallback: string): string {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

function main() {
  const connection = connectionFromEnv();
  const outFile = path.resolve(arg('out', 'nibteam.dump'));

  console.log(`\nExporting ${connection.redacted}\n`);

  // Say what is being copied, so the operator can tell at a glance whether
  // this is the database they meant.
  let summary: string;
  try {
    summary = targetSql(
      connection,
      `SELECT (SELECT count(*) FROM "User") || ' users, ' ||
              (SELECT count(*) FROM "User" WHERE "passwordHash" IS NOT NULL) || ' with a password, ' ||
              (SELECT count(*) FROM "Project") || ' projects, ' ||
              (SELECT count(*) FROM "PendingUser") || ' staged'`,
    );
  } catch {
    throw new Error(
      `Could not read ${connection.database}. Check DATABASE_URL and that PostgreSQL is running.`,
    );
  }
  console.log(`  Contents : ${summary}`);

  // --format=custom so pg_restore can rebuild into a differently named
  // database; a plain SQL dump hard-codes the original name in places.
  run(
    findTool('pg_dump'),
    [
      '--host', connection.host,
      '--port', connection.port,
      '--username', connection.user,
      '--dbname', connection.database,
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      `--file=${outFile}`,
    ],
    connection,
  );

  const size = statSync(outFile).size;
  console.log(`  Written  : ${outFile} (${(size / 1024).toFixed(0)} KB)\n`);
  console.log('  This file holds real password hashes. Copy it over something you');
  console.log('  trust, and delete it once the other machine has loaded it.\n');
  console.log('  On the other machine:  npm run db:import -- --file=nibteam.dump\n');
}

try {
  main();
} catch (error) {
  console.error(`\n${(error as Error).message}\n`);
  process.exitCode = 1;
}
