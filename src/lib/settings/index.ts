import prisma from '@/lib/db';

import {
  SETTINGS_BY_KEY,
  coerce,
  defaultSettings,
  type SettingDefinition,
} from './definitions';

export * from './definitions';

export type SettingsMap = Record<string, string | number | boolean>;

/**
 * Reading configuration.
 *
 * Settings are consulted on nearly every request — a session check reads the
 * idle timeout, a sign-in reads the lockout threshold — and change perhaps
 * monthly. A short in-process cache keeps that from becoming a query per
 * request without making a change take a deployment to appear.
 */
const CACHE_MS = 15_000;
let cache: { value: SettingsMap; expiresAt: number } | null = null;

/** Called after any write, so a change is visible immediately to this process. */
export function invalidateSettingsCache(): void {
  cache = null;
}

/**
 * Every setting, merged over the defaults.
 *
 * A key with no row uses its default, so the system runs correctly against an
 * empty table. If the database cannot be reached at all, this returns the
 * defaults rather than throwing: a settings lookup failing must not take down
 * a sign-in, and the defaults are the safe values.
 */
export async function getSettings(force = false): Promise<SettingsMap> {
  if (!force && cache && cache.expiresAt > Date.now()) return cache.value;

  const merged = defaultSettings();
  try {
    const rows = await prisma.setting.findMany();
    for (const row of rows) {
      const definition = SETTINGS_BY_KEY.get(row.key);
      // A row for a key nobody declares any more is ignored rather than
      // surfaced; removing a setting should not require a data migration.
      if (definition) merged[row.key] = coerce(definition, row.value);
    }
  } catch (error) {
    console.error('Could not read settings; using defaults.', error);
    return merged;
  }

  cache = { value: merged, expiresAt: Date.now() + CACHE_MS };
  return merged;
}

/**
 * One setting, typed by its definition.
 *
 * The generic is a convenience for the caller; the value has already been
 * coerced and clamped by `coerce`, so a number really is a number inside its
 * declared bounds.
 */
export async function getSetting<T extends string | number | boolean>(key: string): Promise<T> {
  const all = await getSettings();
  return all[key] as T;
}

/** A number setting, with the definition's bounds already applied. */
export async function getNumber(key: string): Promise<number> {
  const value = await getSetting<number>(key);
  return typeof value === 'number' ? value : Number(value);
}

/** A boolean setting. */
export async function getBoolean(key: string): Promise<boolean> {
  return Boolean(await getSetting<boolean>(key));
}

/**
 * The definition behind a key, for callers that need its label or bounds —
 * an error message that quotes the limit, for instance.
 */
export function definitionFor(key: string): SettingDefinition | undefined {
  return SETTINGS_BY_KEY.get(key);
}
