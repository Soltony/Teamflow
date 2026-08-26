import { describe, expect, it } from 'vitest';

import {
  ALLOWED_TYPES,
  MAX_FILE_BYTES,
  contentDisposition,
  extensionOf,
  sanitizeFileName,
  validateUpload,
} from './validation';

const bytes = (...values: number[]) => Uint8Array.from(values);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const TEXT = Uint8Array.from(Buffer.from('Minutes of the steering committee\n'));
const WINDOWS_EXE = bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00);
const ELF = bytes(0x7f, 0x45, 0x4c, 0x46);

const upload = (over: Partial<Parameters<typeof validateUpload>[0]> = {}) =>
  validateUpload({ fileName: 'charter.pdf', sizeBytes: 1024, head: PDF, ...over });

describe('validateUpload — accepted files', () => {
  it('accepts each format on the allow-list', () => {
    const cases: [string, Uint8Array][] = [
      ['charter.pdf', PDF],
      ['scope.docx', ZIP],
      ['budget.xlsx', ZIP],
      ['steering.pptx', ZIP],
      ['diagram.png', PNG],
      ['photo.jpg', JPEG],
      ['photo.jpeg', JPEG],
      ['notes.txt', TEXT],
      ['export.csv', TEXT],
    ];
    for (const [fileName, head] of cases) {
      expect(upload({ fileName, head }).ok, fileName).toBe(true);
    }
  });

  it('reports the canonical type from the allow-list, not the browser', () => {
    const result = upload({ fileName: 'charter.pdf', head: PDF, declaredType: 'text/html' });
    expect(result).toMatchObject({ ok: true, contentType: 'application/pdf' });
  });

  it('accepts an extension in any case', () => {
    expect(upload({ fileName: 'CHARTER.PDF', head: PDF }).ok).toBe(true);
  });
});

describe('validateUpload — refusals', () => {
  it('refuses a type that is not on the list', () => {
    for (const name of ['payload.exe', 'archive.zip', 'page.html', 'vector.svg', 'script.js']) {
      expect(upload({ fileName: name, head: TEXT }).ok, name).toBe(false);
    }
  });

  it('refuses a file with no extension', () => {
    expect(upload({ fileName: 'charter', head: PDF }).ok).toBe(false);
  });

  it('refuses an executable renamed to an accepted extension', () => {
    // The attack the byte check exists for.
    const result = upload({ fileName: 'charter.pdf', head: WINDOWS_EXE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('does not look like');
  });

  it('refuses a binary renamed to .txt', () => {
    expect(upload({ fileName: 'notes.txt', head: ELF }).ok).toBe(false);
    expect(upload({ fileName: 'notes.txt', head: WINDOWS_EXE }).ok).toBe(false);
  });

  it('refuses a PNG whose bytes say JPEG', () => {
    expect(upload({ fileName: 'diagram.png', head: JPEG }).ok).toBe(false);
  });

  it('refuses an empty file', () => {
    expect(upload({ sizeBytes: 0 }).ok).toBe(false);
  });

  it('refuses a file over the size cap', () => {
    expect(upload({ sizeBytes: MAX_FILE_BYTES + 1 }).ok).toBe(false);
    expect(upload({ sizeBytes: MAX_FILE_BYTES }).ok).toBe(true);
  });

  it('refuses a truncated file whose signature cannot be read', () => {
    expect(upload({ fileName: 'charter.pdf', head: bytes(0x25) }).ok).toBe(false);
  });
});

describe('sanitizeFileName', () => {
  it('strips any path, so a traversal attempt becomes a plain name', () => {
    expect(sanitizeFileName('../../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
    expect(sanitizeFileName('/absolute/path/report.pdf')).toBe('report.pdf');
  });

  it('strips control characters, so a header cannot be forged', () => {
    const injected = sanitizeFileName('report.pdf\r\nX-Injected: yes');
    expect(injected).not.toContain('\r');
    expect(injected).not.toContain('\n');
  });

  it('does not allow a name that is only dots', () => {
    expect(sanitizeFileName('..')).toBe('file');
    expect(sanitizeFileName('.')).toBe('file');
    expect(sanitizeFileName('')).toBe('file');
  });

  it('keeps a normal name intact', () => {
    expect(sanitizeFileName('Q3 Steering Minutes.pdf')).toBe('Q3 Steering Minutes.pdf');
  });

  it('bounds the length', () => {
    expect(sanitizeFileName('a'.repeat(500) + '.pdf').length).toBeLessThanOrEqual(200);
  });
});

describe('contentDisposition', () => {
  it('always serves as an attachment, never inline', () => {
    expect(contentDisposition('charter.pdf')).toMatch(/^attachment;/);
  });

  it('cannot be used to inject a second header', () => {
    const value = contentDisposition('evil.pdf\r\nSet-Cookie: a=b');
    expect(value).not.toContain('\r');
    expect(value).not.toContain('\n');
  });

  it('carries a non-ASCII name in the encoded form as well', () => {
    const value = contentDisposition('የፕሮጀክት ሰነድ.pdf');
    expect(value).toContain("filename*=UTF-8''");
    // The plain filename stays ASCII so older clients do not choke on it.
    expect(/filename="([^"]*)"/.exec(value)?.[1]).toMatch(/^[\x20-\x7e]*$/);
  });
});

describe('the allow-list itself', () => {
  it('does not admit anything a browser would execute', () => {
    const types = ALLOWED_TYPES.flatMap((t) => t.extensions);
    for (const dangerous of ['svg', 'html', 'htm', 'js', 'exe', 'sh', 'bat', 'zip']) {
      expect(types, dangerous).not.toContain(dangerous);
    }
  });

  it('gives every entry a label, so a refusal can name what is allowed', () => {
    for (const type of ALLOWED_TYPES) {
      expect(type.label.length, type.contentType).toBeGreaterThan(0);
      expect(type.extensions.length).toBeGreaterThan(0);
    }
  });
});

describe('extensionOf', () => {
  it('reads the last extension', () => {
    expect(extensionOf('report.final.pdf')).toBe('pdf');
    expect(extensionOf('archive.tar.gz')).toBe('gz');
  });

  it('is empty when there is none', () => {
    expect(extensionOf('README')).toBe('');
  });
});
