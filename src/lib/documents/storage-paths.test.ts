import { afterEach, describe, expect, it } from 'vitest';
import path from 'path';

import { isValidStorageKey, pathForKey, storageRoot } from './storage-paths';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

const KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('isValidStorageKey', () => {
  it('accepts a 32-character hex key', () => {
    expect(isValidStorageKey(KEY)).toBe(true);
  });

  it('rejects anything that could name a path', () => {
    for (const bad of [
      '../../../../etc/passwd',
      '..\\..\\windows\\system32',
      'a1b2/c3d4',
      '/etc/passwd',
      'a1b2c3d4e5f60718293a4b5c6d7e8f9',    // one short
      'a1b2c3d4e5f60718293a4b5c6d7e8f901',  // one long
      'A1B2C3D4E5F60718293A4B5C6D7E8F90',   // uppercase
      'g1b2c3d4e5f60718293a4b5c6d7e8f90',   // not hex
      '',
    ]) {
      expect(isValidStorageKey(bad), bad).toBe(false);
    }
  });
});

describe('pathForKey', () => {
  it('fans out over two levels, so no directory grows unbounded', () => {
    const result = pathForKey(KEY, '/srv/docs');
    expect(result).toBe(path.join('/srv/docs', 'a1', 'b2', KEY));
  });

  it('throws rather than building a path from an invalid key', () => {
    // Traversal is impossible by construction: the input never reaches a
    // filesystem call, because it is not 32 hex characters.
    expect(() => pathForKey('../../../../etc/passwd')).toThrow('Invalid storage key');
    expect(() => pathForKey('')).toThrow();
  });

  it('always stays under the root it was given', () => {
    const root = '/srv/docs';
    const result = path.resolve(pathForKey(KEY, root));
    expect(result.startsWith(path.resolve(root))).toBe(true);
  });
});

describe('storageRoot', () => {
  it('honours an explicit configuration', () => {
    process.env.DOCUMENT_STORAGE_ROOT = '/mnt/epmo-documents';
    expect(storageRoot()).toBe('/mnt/epmo-documents');
  });

  it('defaults to somewhere outside the web root', () => {
    delete process.env.DOCUMENT_STORAGE_ROOT;
    // Anything under public/ would be served as a static asset, with no
    // authorization check at all.
    expect(storageRoot()).not.toContain(`${path.sep}public`);
  });
});
