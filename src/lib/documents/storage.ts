import 'server-only';

import { createHash, randomBytes } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import path from 'path';

import { pathForKey, storageRoot } from './storage-paths';
import { getBoolean } from '@/lib/settings';

/**
 * Where uploaded files actually live.
 *
 * Two rules shape this:
 *
 *  - **Outside the web root.** Nothing under `public/` — a file served as a
 *    static asset is served without an authorization check, which for a
 *    contract or a signed minute is the whole problem.
 *  - **Opaque keys.** The path on disk is derived from random bytes, never
 *    from the uploader's filename. That removes path traversal as a category
 *    rather than trying to filter it, and stops one upload overwriting
 *    another by choosing the same name.
 *
 * The interface is deliberately small so an object store can replace the local
 * disk without touching anything above it.
 */

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
  /** SHA-256 of the contents, for integrity and duplicate detection. */
  checksum: string;
}

export interface DocumentStorage {
  save(data: Buffer): Promise<StoredFile>;
  createReadStream(storageKey: string): NodeJS.ReadableStream;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}

export const localStorage: DocumentStorage = {
  async save(data: Buffer): Promise<StoredFile> {
    const storageKey = randomBytes(16).toString('hex');
    const target = pathForKey(storageKey);

    await mkdir(path.dirname(target), { recursive: true });
    // 'wx' fails rather than overwrites if the key somehow already exists.
    await writeFile(target, data, { flag: 'wx' });

    return {
      storageKey,
      sizeBytes: data.byteLength,
      checksum: createHash('sha256').update(data).digest('hex'),
    };
  },

  createReadStream(storageKey: string): NodeJS.ReadableStream {
    return createReadStream(pathForKey(storageKey));
  },

  async delete(storageKey: string): Promise<void> {
    await rm(pathForKey(storageKey), { force: true });
  },

  async exists(storageKey: string): Promise<boolean> {
    try {
      await stat(pathForKey(storageKey));
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Virus scanning is not implemented.
 *
 * There is no scanner available to this system, and pretending otherwise would
 * be worse than saying so. This is the hook: point it at ClamAV or the bank's
 * endpoint scanner and it becomes a real check. Until then it is honest about
 * being a no-op, and `DOCUMENT_REQUIRE_SCAN=true` makes uploads fail closed for
 * a deployment that cannot accept unscanned files.
 */
export async function scanForMalware(_data: Buffer): Promise<{ clean: boolean; reason?: string }> {
  // Settable in the admin Settings page now, not only by an environment
  // variable that needs a redeploy. The variable still wins, so a deployment
  // can force it on regardless of what an administrator does.
  const forcedByEnv = (process.env.DOCUMENT_REQUIRE_SCAN || '').toLowerCase() === 'true';
  if (forcedByEnv || (await getBoolean('documents.requireVirusScan'))) {
    return {
      clean: false,
      reason:
        'Uploads are disabled because malware scanning is required but no scanner is configured.',
    };
  }
  return { clean: true };
}
