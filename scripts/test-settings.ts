/**
 * The settings registry, against a real database.
 *
 * The unit tests cover the bounds and coercion. These cover the part that only
 * a database can answer: that a value written to the table actually changes
 * behaviour, that the cache does not hide a change for long, and — most
 * importantly — that a value written outside its bounds cannot weaken a
 * security control.
 *
 *   npx tsx scripts/test-settings.ts
 */
import { PrismaClient } from '@prisma/client';

import {
  SETTING_DEFINITIONS,
  getSettings,
  getNumber,
  getBoolean,
  invalidateSettingsCache,
} from '../src/lib/settings';
import { validatePasswordStrength } from '../src/lib/auth/password';
import { validateUpload } from '../src/lib/documents/validation';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

/** Keys this test writes, so it can put them back exactly as it found them. */
const TOUCHED = [
  'security.maxFailedLogins',
  'security.passwordMinLength',
  'security.sessionIdleMinutes',
  'documents.maxUploadMb',
  'documents.requireVirusScan',
];

let original: Record<string, string | null> = {};

async function snapshot() {
  const rows = await prisma.setting.findMany({ where: { key: { in: TOUCHED } } });
  original = Object.fromEntries(TOUCHED.map((k) => [k, null]));
  for (const row of rows) original[row.key] = row.value;
}

async function restore() {
  for (const [key, value] of Object.entries(original)) {
    if (value === null) await prisma.setting.deleteMany({ where: { key } });
    else await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  invalidateSettingsCache();
}

async function write(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  invalidateSettingsCache();
}

async function main() {
  console.log('\nSettings registry\n');
  await snapshot();

  // ------------------------------------------------------------- defaults
  console.log('1. An empty table still works\n');

  for (const key of TOUCHED) await prisma.setting.deleteMany({ where: { key } });
  invalidateSettingsCache();

  const defaults = await getSettings(true);
  check('every declared setting has a value', SETTING_DEFINITIONS.every((d) => defaults[d.key] !== undefined));
  check('the lockout threshold falls back to five', (await getNumber('security.maxFailedLogins')) === 5);
  check('the upload limit falls back to 25 MB', (await getNumber('documents.maxUploadMb')) === 25);

  // ------------------------------------------------------- taking effect
  console.log('\n2. A saved value takes effect\n');

  await write('security.maxFailedLogins', '3');
  check('the lockout threshold reads back as three', (await getNumber('security.maxFailedLogins')) === 3);

  await write('documents.maxUploadMb', '5');
  const fiveMb = (await getNumber('documents.maxUploadMb')) * 1024 * 1024;
  const tooBig = validateUpload({
    fileName: 'plan.pdf',
    sizeBytes: 6 * 1024 * 1024,
    maxBytes: fiveMb,
    head: new Uint8Array(Buffer.from('%PDF-1.7')),
  });
  check('a 6 MB upload is refused once the limit is 5 MB', !tooBig.ok);
  check('and the message quotes the configured limit',
    !tooBig.ok && tooBig.error.includes('5 MB'), !tooBig.ok ? tooBig.error : '');

  await write('documents.requireVirusScan', 'true');
  check('the scan requirement reads back as on', (await getBoolean('documents.requireVirusScan')) === true);

  // ----------------------------------------------------- the safety floor
  console.log('\n3. A bad value cannot weaken a control\n');

  // Written straight to the table, bypassing the form entirely — a support
  // script or a direct edit could do exactly this.
  await write('security.passwordMinLength', '1');
  const minLength = await getNumber('security.passwordMinLength');
  check('a password minimum of 1 is clamped to 8', minLength === 8, `got ${minLength}`);
  check('and a 6-character password is still refused',
    validatePasswordStrength('Ab1!de', minLength) !== null);

  await write('security.maxFailedLogins', '9999');
  check('lockout cannot be disabled by a huge threshold',
    (await getNumber('security.maxFailedLogins')) === 10);

  await write('security.sessionIdleMinutes', '0');
  check('an idle timeout of zero is clamped to the minimum',
    (await getNumber('security.sessionIdleMinutes')) === 5);

  await write('security.sessionIdleMinutes', 'not a number');
  check('unparseable text falls back to the default',
    (await getNumber('security.sessionIdleMinutes')) === 15);

  // ------------------------------------------------------------- caching
  console.log('\n4. The cache does not hide a change\n');

  await write('documents.maxUploadMb', '40');
  check('a change is visible immediately after invalidation',
    (await getNumber('documents.maxUploadMb')) === 40);

  // A row for a key nobody declares must not break the read.
  await prisma.setting.upsert({
    where: { key: 'removed.old-setting' },
    update: { value: 'x' },
    create: { key: 'removed.old-setting', value: 'x' },
  });
  invalidateSettingsCache();
  const withStray = await getSettings(true);
  check('a row for an undeclared key is ignored, not surfaced',
    withStray['removed.old-setting'] === undefined);
  await prisma.setting.deleteMany({ where: { key: 'removed.old-setting' } });

  await restore();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch(async (e) => { console.error(e); await restore().catch(() => {}); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
