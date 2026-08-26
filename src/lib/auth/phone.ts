/**
 * Phone numbers arrive in three shapes across the system:
 *   - the login form, which strips everything but digits  -> "0912345678"
 *   - this application's User table                       -> "0912345678"
 *   - the legacy auth database                            -> "+251912345678"
 *
 * Everything is normalised to the local Ethiopian form ("0" + 9 digits) so a
 * single lookup works regardless of how the number was typed or stored.
 */

const COUNTRY_CODE = '251';

/** Returns the canonical local form, or null when the input cannot be one. */
export function normalizePhoneNumber(input: string | null | undefined): string | null {
  if (!input) return null;

  let digits = input.replace(/\D/g, '');
  if (!digits) return null;

  // 00251… international prefix
  if (digits.startsWith('00' + COUNTRY_CODE)) digits = digits.slice(2);
  // 251912345678 -> 0912345678
  if (digits.startsWith(COUNTRY_CODE) && digits.length === COUNTRY_CODE.length + 9) {
    digits = '0' + digits.slice(COUNTRY_CODE.length);
  }
  // 912345678 -> 0912345678
  if (digits.length === 9 && !digits.startsWith('0')) {
    digits = '0' + digits;
  }

  if (digits.length !== 10 || !digits.startsWith('0')) return null;
  return digits;
}

/** The +251… form, for display or for any external system that expects it. */
export function toInternationalPhoneNumber(input: string | null | undefined): string | null {
  const local = normalizePhoneNumber(input);
  if (!local) return null;
  return `+${COUNTRY_CODE}${local.slice(1)}`;
}
