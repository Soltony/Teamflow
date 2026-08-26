import path from 'path';

/**
 * Where a stored file lives on disk, given its key.
 *
 * Kept separate from storage.ts — which carries a `server-only` guard and
 * touches the filesystem — so this, the part that decides a path, can be unit
 * tested directly. Path derivation is where a traversal bug would live, so it
 * is the piece most worth testing.
 */

/**
 * Storage keys are 32 hex characters and nothing else.
 *
 * The key is generated from random bytes and never derived from a filename, so
 * this check should never fail in practice. It exists so that traversal is
 * impossible by construction rather than by filtering: `../../etc/passwd` is
 * not 32 hex characters, so it cannot reach the filesystem call at all.
 */
export function isValidStorageKey(key: string): boolean {
  return /^[0-9a-f]{32}$/.test(key);
}

/**
 * The storage root.
 *
 * Defaults to a dot-directory beside the application rather than anywhere under
 * `public/`, because a file served as a static asset is served with no
 * authorization check at all.
 */
export function storageRoot(): string {
  return process.env.DOCUMENT_STORAGE_ROOT || path.join(process.cwd(), '.document-storage');
}

/**
 * Fans files out over two levels of subdirectory.
 *
 * A single directory holding tens of thousands of entries is slow to list and
 * unpleasant to operate on; the first four characters of the key give 65,536
 * buckets for nothing.
 */
export function pathForKey(key: string, root = storageRoot()): string {
  if (!isValidStorageKey(key)) {
    throw new Error('Invalid storage key');
  }
  return path.join(root, key.slice(0, 2), key.slice(2, 4), key);
}
