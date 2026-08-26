/**
 * Checks that this system can read and reproduce ASP.NET Core Identity hashes
 * before we depend on them for sign-in.
 *
 *   npx tsx scripts/verify-password-compat.ts
 */
import { createHmac, pbkdf2Sync, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

import { describeHash, hashPassword, verifyPassword, validatePasswordStrength } from '../src/lib/auth/password';

let failures = 0;
function check(name: string, condition: boolean, extra = '') {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

/**
 * An independent implementation of the ASP.NET Identity v3 hash, written from
 * the documented layout rather than reusing our own module, so that agreement
 * between the two is real evidence and not a tautology.
 */
function referenceV3Hash(password: string, salt: Buffer, iterations: number, prf: number, subkeyLen: number) {
  const digest = prf === 0 ? 'sha1' : prf === 1 ? 'sha256' : 'sha512';
  const subkey = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, iterations, subkeyLen, digest);
  const header = Buffer.alloc(13);
  header[0] = 0x01;
  header.writeUInt32BE(prf, 1);
  header.writeUInt32BE(iterations, 5);
  header.writeUInt32BE(salt.length, 9);
  return Buffer.concat([header, salt, subkey]).toString('base64');
}

async function main() {
  console.log('\n1. Parsing the 50 credentials migrated from TeamAuthDb\n');

  const dataPath = path.join(__dirname, 'data', 'legacy-auth-users.json');
  const legacy = JSON.parse(readFileSync(dataPath, 'utf8')) as {
    users: { id: string; email: string; passwordHash: string }[];
  };

  const parsed = legacy.users.map((u) => ({ email: u.email, info: describeHash(u.passwordHash) }));
  const unparseable = parsed.filter((p) => !p.info);
  check(`all ${legacy.users.length} legacy hashes parse`, unparseable.length === 0,
    unparseable.map((u) => u.email).join(', '));

  const shapes = new Set(parsed.filter((p) => p.info).map((p) => {
    const i = p.info!;
    return `v${i.version} ${i.digest} iter=${i.iterations} salt=${i.saltBytes} subkey=${i.subkeyBytes}`;
  }));
  console.log(`        parameter shapes present: ${[...shapes].join(' | ')}`);
  check('every legacy hash uses a supported PRF', [...shapes].every((s) => /sha(1|256|512)/.test(s)));

  console.log('\n2. Verifying against an independent implementation of the format\n');

  // Build a hash exactly the way the legacy service would have, then confirm
  // our verifier accepts the correct password and rejects near misses.
  const password = 'Str0ng!Passw0rd';
  const salt = randomBytes(16);
  const legacyStyle = referenceV3Hash(password, salt, 100_000, 2, 32);

  check('legacy-parameter hash is parsed as v3/sha512/100000',
    JSON.stringify(describeHash(legacyStyle)) ===
      JSON.stringify({ version: 3, digest: 'sha512', iterations: 100_000, saltBytes: 16, subkeyBytes: 32 }));

  const good = await verifyPassword(password, legacyStyle);
  check('correct password verifies against a legacy-format hash', good.valid);
  check('legacy 100k-iteration hash is flagged for upgrade', good.needsUpgrade);

  const wrong = await verifyPassword('Str0ng!Passw0rd ', legacyStyle);
  check('trailing-space variant is rejected', !wrong.valid);
  check('wrong password is rejected', !(await verifyPassword('nope', legacyStyle)).valid);
  check('empty password is rejected', !(await verifyPassword('', legacyStyle)).valid);
  check('null stored hash is rejected', !(await verifyPassword(password, null)).valid);
  check('garbage stored hash is rejected', !(await verifyPassword(password, 'not-base64!!')).valid);

  console.log('\n3. Hashes we write ourselves\n');

  const fresh = await hashPassword(password);
  const freshInfo = describeHash(fresh)!;
  check('new hash is v3/sha512', freshInfo.version === 3 && freshInfo.digest === 'sha512');
  check('new hash uses >= 210,000 iterations', freshInfo.iterations >= 210_000,
    `got ${freshInfo.iterations}`);

  const freshCheck = await verifyPassword(password, fresh);
  check('new hash verifies', freshCheck.valid);
  check('new hash is not flagged for upgrade', !freshCheck.needsUpgrade);
  check('two hashes of the same password differ (salted)', (await hashPassword(password)) !== fresh);

  // Cross-check: our own hash must be reproducible by the reference routine,
  // which is what guarantees a future .NET service could still read it.
  const buf = Buffer.from(fresh, 'base64');
  const ourSalt = buf.subarray(13, 13 + freshInfo.saltBytes);
  const reproduced = referenceV3Hash(password, ourSalt, freshInfo.iterations, 2, freshInfo.subkeyBytes);
  check('our hash is byte-identical to the reference implementation', reproduced === fresh);

  console.log('\n4. Password policy\n');
  check('rejects short passwords', validatePasswordStrength('Ab1!') !== null);
  check('rejects missing uppercase', validatePasswordStrength('abcdefg1!') !== null);
  check('rejects missing digit', validatePasswordStrength('Abcdefgh!') !== null);
  check('rejects missing symbol', validatePasswordStrength('Abcdefg1') !== null);
  check('accepts a compliant password', validatePasswordStrength('Str0ng!Passw0rd') === null);

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
