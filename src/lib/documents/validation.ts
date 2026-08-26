/**
 * What this system is willing to accept as an uploaded file.
 *
 * Nothing here trusts the browser. The `Content-Type` on an upload and the
 * extension on a filename are both attacker-controlled: a file called
 * `charter.pdf` announcing `application/pdf` can contain anything at all. The
 * checks below look at the bytes.
 *
 * Pure functions, so the rules can be unit tested without a filesystem.
 */

export interface AllowedType {
  /** The canonical content type stored and served back. */
  contentType: string;
  extensions: string[];
  label: string;
  /**
   * Leading bytes that identify the format. Empty for formats that have no
   * reliable signature (plain text, CSV), which are handled separately.
   */
  signatures: number[][];
}

/**
 * The allow-list. Deliberately an allow-list rather than a deny-list: the
 * formats an EPMO needs are few and known, and anything not named here is
 * refused rather than guessed at.
 *
 * Note what is absent: no SVG (it executes script in a browser context), no
 * HTML, no archives, and nothing executable.
 */
export const ALLOWED_TYPES: AllowedType[] = [
  {
    contentType: 'application/pdf',
    extensions: ['pdf'],
    label: 'PDF',
    signatures: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  },
  {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    label: 'Word document',
    signatures: [[0x50, 0x4b, 0x03, 0x04]], // ZIP container
  },
  {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    label: 'Excel workbook',
    signatures: [[0x50, 0x4b, 0x03, 0x04]],
  },
  {
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    label: 'PowerPoint deck',
    signatures: [[0x50, 0x4b, 0x03, 0x04]],
  },
  {
    contentType: 'image/png',
    extensions: ['png'],
    label: 'PNG image',
    signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  {
    contentType: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    label: 'JPEG image',
    signatures: [[0xff, 0xd8, 0xff]],
  },
  {
    contentType: 'text/plain',
    extensions: ['txt'],
    label: 'Text file',
    signatures: [],
  },
  {
    contentType: 'text/csv',
    extensions: ['csv'],
    label: 'CSV file',
    signatures: [],
  },
];

/** 25 MB. Large enough for a scanned contract, small enough to bound a request. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ACCEPT_ATTRIBUTE = ALLOWED_TYPES.flatMap((t) => t.extensions.map((e) => `.${e}`)).join(',');

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * Sanitises a filename for storage in the database and for the
 * `Content-Disposition` header.
 *
 * Strips directory separators and control characters, so a name like
 * `../../etc/passwd` or one containing a newline cannot escape its field or
 * forge a second header line. The result is a label only — it is never used to
 * build a path on disk.
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = cleaned.replace(/^\.+/, '') || 'file';
  return safe.slice(0, 200);
}

export type ValidationResult =
  | { ok: true; contentType: string; fileName: string; label: string }
  | { ok: false; error: string };

/**
 * Decides whether an upload may be stored.
 *
 * `declaredType` is accepted as a hint only; the extension and the leading
 * bytes have to agree with an entry in the allow-list. A mismatch is refused
 * rather than resolved in the uploader's favour.
 */
export function validateUpload(input: {
  fileName: string;
  sizeBytes: number;
  declaredType?: string | null;
  /** The configured limit in bytes. Defaults to the compiled-in 25 MB. */
  maxBytes?: number;
  head: Uint8Array;
}): ValidationResult {
  const fileName = sanitizeFileName(input.fileName);

  if (input.sizeBytes <= 0) {
    return { ok: false, error: 'The file is empty.' };
  }
  // Passed in rather than read here: this module is pure so the rules can be
  // unit tested, and the caller already has the setting.
  const maxBytes = input.maxBytes ?? MAX_FILE_BYTES;
  if (input.sizeBytes > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `Files must be ${mb} MB or smaller.` };
  }

  const extension = extensionOf(fileName);
  const byExtension = ALLOWED_TYPES.find((t) => t.extensions.includes(extension));
  if (!byExtension) {
    const allowed = ALLOWED_TYPES.map((t) => t.label).join(', ');
    return { ok: false, error: `That file type is not accepted. Allowed: ${allowed}.` };
  }

  // Formats with a signature must actually carry it.
  if (byExtension.signatures.length > 0) {
    const matches = byExtension.signatures.some((sig) => matchesSignature(input.head, sig));
    if (!matches) {
      return {
        ok: false,
        error: `This file does not look like a ${byExtension.label}. It may be renamed or corrupt.`,
      };
    }
  } else if (containsBinary(input.head)) {
    // Text formats have no signature, so instead refuse anything that is
    // plainly not text — which is how an executable gets in as a ".txt".
    return { ok: false, error: `A ${byExtension.label} must contain text.` };
  }

  return {
    ok: true,
    // The stored type comes from the allow-list, never from the request.
    contentType: byExtension.contentType,
    fileName,
    label: byExtension.label,
  };
}

/**
 * Null bytes and stray control characters mean this is not a text file.
 *
 * Bytes at or above 0x80 are left alone: they are ordinary UTF-8 continuation
 * bytes, and rejecting them would refuse any document written in Amharic. DEL
 * (0x7f) is not printable despite sitting above the control range, which is
 * how an ELF binary — whose header starts 0x7f 'E' 'L' 'F' — would otherwise
 * pass as a .txt.
 */
function containsBinary(bytes: Uint8Array): boolean {
  for (const byte of bytes.subarray(0, 512)) {
    if (byte === 0x00 || byte === 0x7f) return true;
    const isPrintable = byte >= 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (!isPrintable) return true;
  }
  return false;
}

/**
 * A `Content-Disposition` value that cannot be used to inject a header or to
 * mislead about the file type.
 *
 * Always `attachment`: serving a user-supplied file inline is how a stored
 * cross-site scripting hole gets built.
 */
export function contentDisposition(fileName: string): string {
  const safe = sanitizeFileName(fileName);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
