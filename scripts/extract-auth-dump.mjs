/**
 * Reads a PostgreSQL custom-format dump (pg_dump -Fc) of the legacy TeamAuthDb
 * and writes the AspNetUsers / AspNetRoles / AspNetUserRoles rows to JSON.
 *
 * Used once, to produce scripts/data/legacy-auth-users.json, so the credential
 * import does not require the legacy database or pg_restore to be available.
 *
 *   node scripts/extract-auth-dump.mjs "<path to TeamAuthDb .sql>"
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error('usage: node scripts/extract-auth-dump.mjs <dump file>');
  process.exit(1);
}

const buf = fs.readFileSync(dumpPath);

// pg_dump custom format writes ints as: 1 sign byte + N little-endian magnitude bytes.
function readInt(pos) {
  const sign = buf[pos];
  const value = buf.readUInt32LE(pos + 1);
  return sign ? -value : value;
}

/**
 * Data blocks are a zlib stream split into length-prefixed chunks. Re-assemble
 * the chunks starting at `start`, then inflate the whole stream.
 */
function inflateBlockAt(start) {
  if (start < 5) return null;
  let length = readInt(start - 5);
  if (length <= 0 || start + length > buf.length) return null;

  const chunks = [];
  let pos = start;
  while (length > 0) {
    if (pos + length > buf.length) return null;
    chunks.push(buf.subarray(pos, pos + length));
    pos += length;
    if (pos + 5 > buf.length) break;
    length = readInt(pos);
    pos += 5;
    if (length < 0 || length > 1 << 24) return null;
  }
  try {
    return zlib.inflateSync(Buffer.concat(chunks)).toString('utf8');
  } catch {
    return null;
  }
}

const blocks = [];
const seen = new Set();
for (let i = 5; i < buf.length - 2; i++) {
  if (buf[i] !== 0x78) continue;
  const second = buf[i + 1];
  if (second !== 0x01 && second !== 0x9c && second !== 0xda && second !== 0x5e) continue;
  const text = inflateBlockAt(i);
  if (!text || text.length < 20) continue;
  const key = text.slice(0, 60);
  if (seen.has(key)) continue;
  seen.add(key);
  blocks.push(text);
}

const COPY_TERMINATOR = '\\.'; // pg_dump writes this after the last row
const COPY_NULL = '\\N';

const rowsOf = (text) =>
  text
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length > 0 && line !== COPY_TERMINATOR)
    .map((line) => line.split('\t').map((v) => (v === COPY_NULL ? null : v)));

/** Keep only rows whose column count matches the table's shape. */
const widthOf = (rows, width) => rows.filter((r) => r.length === width);
const isUuid = (v) => /^[0-9a-f-]{36}$/.test(v ?? '');

// Identify each block by its column shape rather than by position in the file.
let users = [], roles = [], userRoles = [];
for (const block of blocks) {
  const rows = rowsOf(block);
  if (!rows.length) continue;
  const asUsers = widthOf(rows, 18).filter((r) => isUuid(r[0]) && /^AQ/.test(r[10] ?? ''));
  const asRoles = widthOf(rows, 4).filter((r) => isUuid(r[0]));
  const asUserRoles = widthOf(rows, 2).filter((r) => isUuid(r[0]) && isUuid(r[1]));
  if (asUsers.length) users = asUsers;
  else if (asRoles.length) roles = asRoles;
  else if (asUserRoles.length) userRoles = asUserRoles;
}

if (!users.length) {
  console.error('Could not locate the AspNetUsers data block in this dump.');
  process.exit(1);
}

const roleNameById = new Map(roles.map((r) => [r[0], r[1]]));
const legacyRolesByUser = new Map();
for (const [userId, roleId] of userRoles) {
  if (!legacyRolesByUser.has(userId)) legacyRolesByUser.set(userId, []);
  legacyRolesByUser.get(userId).push(roleNameById.get(roleId) ?? roleId);
}

const payload = {
  source: path.basename(dumpPath),
  extractedAt: new Date().toISOString(),
  users: users.map((r) => ({
    id: r[0],
    firstName: r[1],
    lastName: r[2],
    phoneNumber: r[3],
    mustChangePassword: r[4] === 't',
    email: r[7],
    emailConfirmed: r[9] === 't',
    passwordHash: r[10],
    phoneNumberConfirmed: r[13] === 't',
    lockoutEnd: r[15],
    legacyRoles: legacyRolesByUser.get(r[0]) ?? [],
  })),
};

const outPath = path.join('scripts', 'data', 'legacy-auth-users.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`Wrote ${payload.users.length} users to ${outPath}`);
console.log(`Legacy roles found: ${[...roleNameById.values()].join(', ')}`);
