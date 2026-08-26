/**
 * Locating PostgreSQL's command-line tools, and reading the connection URL.
 *
 * Shared by db-export and db-import. On Windows the tools are almost never on
 * PATH — they live under `C:\Program Files\PostgreSQL\<version>\bin` — so this
 * looks there before giving up, and says exactly what it could not find.
 */
import { execFileSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import path from 'path';

// These scripts never construct a PrismaClient, which is what normally pulls
// .env in. Without this they see no DATABASE_URL and fail on a correctly
// configured machine.
import 'dotenv/config';

export interface Connection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  /** The URL with the password replaced, for printing. */
  redacted: string;
}

/**
 * Reads DATABASE_URL into its parts.
 *
 * `pg_dump` takes a URL directly, but the parts are needed for the psql calls
 * that create and drop databases, which cannot be aimed at the target database
 * itself.
 */
export function connectionFromEnv(): Connection {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'DATABASE_URL is not set. It is normally read from .env; check that file exists.',
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL: ${raw.replace(/:[^:@/]*@/, ':***@')}`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new Error('DATABASE_URL does not name a database.');

  return {
    host: url.hostname || 'localhost',
    port: url.port || '5432',
    user: decodeURIComponent(url.username) || 'postgres',
    password: decodeURIComponent(url.password),
    database,
    redacted: raw.replace(/:[^:@/]*@/, ':***@'),
  };
}

const WINDOWS_ROOTS = [
  'C:\\Program Files\\PostgreSQL',
  'C:\\Program Files (x86)\\PostgreSQL',
];

/**
 * Finds one of pg_dump, pg_restore or psql.
 *
 * Prefers whatever is on PATH, so a deliberately chosen version wins. Falls
 * back to the newest version installed in the standard Windows location.
 */
export function findTool(name: 'pg_dump' | 'pg_restore' | 'psql'): string {
  const onPath = process.platform === 'win32' ? `${name}.exe` : name;

  try {
    // `--version` is harmless and proves the binary runs.
    execFileSync(onPath, ['--version'], { stdio: 'ignore' });
    return onPath;
  } catch {
    // Not on PATH; keep looking.
  }

  if (process.platform === 'win32') {
    const candidates: Array<{ version: number; file: string }> = [];
    for (const root of WINDOWS_ROOTS) {
      if (!existsSync(root)) continue;
      for (const entry of readdirSync(root)) {
        const file = path.join(root, entry, 'bin', `${name}.exe`);
        if (existsSync(file)) candidates.push({ version: Number(entry) || 0, file });
      }
    }
    // Newest first, so a machine with several versions uses the current one.
    candidates.sort((a, b) => b.version - a.version);
    if (candidates.length > 0) return candidates[0].file;
  }

  throw new Error(
    `Could not find ${name}.\n` +
      (process.platform === 'win32'
        ? `  Looked on PATH and under ${WINDOWS_ROOTS.join(' and ')}.\n` +
          '  Install the PostgreSQL client tools, or add its bin folder to PATH.'
        : `  Install the PostgreSQL client tools (postgresql-client).`),
  );
}

/** Runs a tool with the password supplied out of band rather than on the command line. */
export function run(
  tool: string,
  args: string[],
  connection: Connection,
  options: { capture?: boolean } = {},
): string {
  return (
    execFileSync(tool, args, {
      // PGPASSWORD keeps the password out of the process list, where a command
      // line argument would be visible to every user on the machine.
      env: { ...process.env, PGPASSWORD: connection.password },
      encoding: 'utf8',
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    }) || ''
  );
}

/** A single SQL statement against the `postgres` maintenance database. */
export function maintenanceSql(connection: Connection, sql: string): string {
  return run(
    findTool('psql'),
    [
      '--host', connection.host,
      '--port', connection.port,
      '--username', connection.user,
      '--dbname', 'postgres',
      '--no-psqlrc',
      '--quiet',
      '--tuples-only',
      '--no-align',
      '--command', sql,
    ],
    connection,
    { capture: true },
  ).trim();
}

/** A single SQL statement against the application's own database. */
export function targetSql(connection: Connection, sql: string): string {
  return run(
    findTool('psql'),
    [
      '--host', connection.host,
      '--port', connection.port,
      '--username', connection.user,
      '--dbname', connection.database,
      '--no-psqlrc',
      '--quiet',
      '--tuples-only',
      '--no-align',
      '--command', sql,
    ],
    connection,
    { capture: true },
  ).trim();
}
