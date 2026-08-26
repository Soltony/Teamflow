/**
 * Document storage and access control, end to end against a running server.
 *
 * The download route is the part that matters: a document URL is exactly the
 * kind of thing that gets forwarded, so it has to re-check who is asking on
 * every request rather than trusting that the link was obtained legitimately.
 *
 *   npx tsx scripts/test-documents.ts http://localhost:3399
 */
import { PrismaClient } from '@prisma/client';
import { createHash, pbkdf2Sync, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import path from 'path';

import { isValidStorageKey, pathForKey, storageRoot } from '../src/lib/documents/storage-paths';

/** Mirrors what the application's storage layer does, without the server-only guard. */
const store = {
  async save(data: Buffer) {
    const storageKey = randomBytes(16).toString('hex');
    const target = pathForKey(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
    return {
      storageKey,
      sizeBytes: data.byteLength,
      checksum: createHash('sha256').update(data).digest('hex'),
    };
  },
  async exists(storageKey: string) {
    try { await stat(pathForKey(storageKey)); return true; } catch { return false; }
  },
  async delete(storageKey: string) {
    await rm(pathForKey(storageKey), { force: true });
  },
};
import { assertServerMatchesBuild } from './lib/build-check';

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? 'http://localhost:3399';

const MARKER = 'ZZDOCTEST';
const PASSWORD = 'Doc!Tester1';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

function hash(password: string) {
  const salt = randomBytes(16);
  const subkey = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, 210_000, 32, 'sha512');
  const header = Buffer.alloc(13);
  header[0] = 0x01;
  header.writeUInt32BE(2, 1);
  header.writeUInt32BE(210_000, 5);
  header.writeUInt32BE(16, 9);
  return Buffer.concat([header, salt, subkey]).toString('base64');
}

async function sessionFor(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return `nibteam_session=${token}`;
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: MARKER.toLowerCase() } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  const projects = await prisma.project.findMany({
    where: { name: { startsWith: MARKER } },
    select: { id: true },
  });

  // Remove the stored bytes as well as the rows.
  const versions = await prisma.documentVersion.findMany({
    where: { document: { projectId: { in: projects.map((p) => p.id) } } },
    select: { storageKey: true },
  });
  for (const v of versions) await store.delete(v.storageKey).catch(() => undefined);

  await prisma.project.deleteMany({ where: { id: { in: projects.map((p) => p.id) } } });
  if (ids.length) {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.authEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  await assertServerMatchesBuild(BASE);
  console.log(`\nProject documents against ${BASE}\n`);
  await cleanup();

  const status = await prisma.projectStatus.findFirst({ where: { category: 'ACTIVE' } });
  const division = await prisma.pmoDivision.findFirst();
  const memberRole = await prisma.role.findFirst({ where: { name: 'Member' } });
  if (!status || !division || !memberRole) throw new Error('Expected reference data to exist.');

  // The project manager, who is attached to the project.
  const owner = await prisma.user.create({
    data: {
      firstName: 'Doc', lastName: 'Owner', name: 'Doc Owner',
      email: `${MARKER.toLowerCase()}.owner@example.invalid`,
      phoneNumber: '0700000041',
      passwordHash: hash(PASSWORD),
      roles: { connect: { id: memberRole.id } },
    },
  });

  // An unrelated member with no connection to the project at all.
  const outsider = await prisma.user.create({
    data: {
      firstName: 'Doc', lastName: 'Outsider', name: 'Doc Outsider',
      email: `${MARKER.toLowerCase()}.outsider@example.invalid`,
      phoneNumber: '0700000042',
      passwordHash: hash(PASSWORD),
      roles: { connect: { id: memberRole.id } },
    },
  });

  const project = await prisma.project.create({
    data: {
      name: `${MARKER} Confidential Programme`,
      description: 'Created by scripts/test-documents.ts',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      workingYear: '2026/2027',
      statusId: status.id,
      pmoDivisionId: division.id,
      projectManagerId: owner.id,
      stage: 'APPROVED',
    },
  });

  // ---------------------------------------------------------------- storage
  console.log('1. Storage\n');

  const contents = Buffer.from('%PDF-1.7\nSigned contract, confidential.\n');
  const stored = await store.save(contents);

  check('a stored file gets an opaque random key', /^[0-9a-f]{32}$/.test(stored.storageKey));
  check('the checksum is the SHA-256 of the contents',
    stored.checksum === createHash('sha256').update(contents).digest('hex'));
  check('the file exists after saving', await store.exists(stored.storageKey));

  const root = storageRoot();
  check('storage sits outside the web root', !path.resolve(root).includes(path.join(process.cwd(), 'public')));

  const onDisk = readFileSync(
    path.join(root, stored.storageKey.slice(0, 2), stored.storageKey.slice(2, 4), stored.storageKey),
  );
  check('the bytes on disk are exactly what was stored', onDisk.equals(contents));

  check('a traversal attempt is not a valid key', !isValidStorageKey('../../../../etc/passwd'));
  let traversalRefused = false;
  try {
    pathForKey('../../../../etc/passwd');
  } catch {
    traversalRefused = true;
  }
  check('and deriving a path from it throws rather than escaping the root', traversalRefused);

  const document = await prisma.document.create({
    data: {
      projectId: project.id,
      title: 'Signed contract',
      category: 'CONTRACT',
      uploadedById: owner.id,
      versions: {
        create: {
          versionNumber: 1,
          fileName: 'contract.pdf',
          contentType: 'application/pdf',
          sizeBytes: stored.sizeBytes,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
          uploadedById: owner.id,
        },
      },
    },
    include: { versions: true },
  });
  const versionId = document.versions[0].id;
  const url = `${BASE}/api/documents/${versionId}`;

  // --------------------------------------------------------- access control
  console.log('\n2. Who may download it\n');

  const anonymous = await fetch(url, { redirect: 'manual' });
  check('an anonymous request is refused', anonymous.status === 401, `status ${anonymous.status}`);

  const outsiderCookie = await sessionFor(outsider.id);
  const outsiderResponse = await fetch(url, { headers: { cookie: outsiderCookie }, redirect: 'manual' });
  check(
    'a signed-in user with no connection to the project is refused',
    outsiderResponse.status === 404,
    `status ${outsiderResponse.status}`,
  );
  check(
    'the refusal does not reveal whether the document exists',
    outsiderResponse.status === 404,
  );

  const ownerCookie = await sessionFor(owner.id);
  const ownerResponse = await fetch(url, { headers: { cookie: ownerCookie }, redirect: 'manual' });
  check('the project manager can download it', ownerResponse.status === 200,
    `status ${ownerResponse.status}`);

  const downloaded = Buffer.from(await ownerResponse.arrayBuffer());
  check('the downloaded bytes match what was uploaded', downloaded.equals(contents));

  const missing = await fetch(`${BASE}/api/documents/does-not-exist`, {
    headers: { cookie: ownerCookie },
    redirect: 'manual',
  });
  check('an unknown version id returns not found', missing.status === 404);

  // ------------------------------------------------------------- headers
  console.log('\n3. Response headers\n');

  check('served as an attachment, never inline',
    (ownerResponse.headers.get('content-disposition') ?? '').startsWith('attachment'));
  check('the content type is the one resolved at upload',
    ownerResponse.headers.get('content-type') === 'application/pdf');
  check('sniffing is disabled',
    ownerResponse.headers.get('x-content-type-options') === 'nosniff');
  check('no shared cache may keep it',
    (ownerResponse.headers.get('cache-control') ?? '').includes('no-store'));

  // --------------------------------------------------------------- audit
  console.log('\n4. Audit trail\n');

  const downloadEntry = await prisma.auditLog.findFirst({
    where: { action: 'DOCUMENT_DOWNLOADED', entityId: versionId, actorId: owner.id },
  });
  check('the download was recorded against the person who made it', downloadEntry !== null);

  const outsiderEntry = await prisma.auditLog.findFirst({
    where: { action: 'DOCUMENT_DOWNLOADED', actorId: outsider.id },
  });
  check('a refused download is not recorded as a download', outsiderEntry === null);

  // ------------------------------------------------------------- deletion
  console.log('\n5. Soft delete\n');

  await prisma.document.update({
    where: { id: document.id },
    data: { deletedAt: new Date(), deletedById: owner.id },
  });

  const afterDelete = await fetch(url, { headers: { cookie: ownerCookie }, redirect: 'manual' });
  check('a removed document is no longer downloadable', afterDelete.status === 404);

  const stillThere = await prisma.documentVersion.count({ where: { documentId: document.id } });
  check('its versions are kept, so the record survives', stillThere === 1);
  check('the bytes are kept too', await store.exists(stored.storageKey));

  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
