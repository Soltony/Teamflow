'use server';

import { revalidatePath } from 'next/cache';

import prisma from '@/lib/db';
import { permit } from '@/lib/auth/guard';
import { auditAction } from '@/lib/auth/audit-context';
import { AUDIT_ACTIONS } from '@/lib/audit-log';
import {
  SETTING_DEFINITIONS,
  SETTINGS_BY_KEY,
  getSettings,
  invalidateSettingsCache,
  validate,
} from '@/lib/settings';

/**
 * Reading and changing system configuration.
 *
 * Separate from settings/actions.ts, which manages users, roles and statuses.
 * This file deals only with the values declared in the settings registry.
 */

type Result<T extends object = Record<never, never>> =
  | ({ success: true } & T)
  | { success: false; error: string };

export async function getSystemSettings() {
  const guard = await permit('settings:manage');
  if (!guard.ok) return { success: false as const, error: guard.denied.error };

  const [values, rows] = await Promise.all([
    // Forced, so the page never shows a value 15 seconds out of date and then
    // saves it back over somebody else's change.
    getSettings(true),
    prisma.setting.findMany({
      select: {
        key: true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  const lastChanged: Record<string, { at: string; by: string | null }> = {};
  for (const row of rows) {
    lastChanged[row.key] = {
      at: row.updatedAt.toISOString(),
      by: row.updatedBy?.name ?? null,
    };
  }

  return {
    success: true as const,
    definitions: SETTING_DEFINITIONS,
    values,
    lastChanged,
  };
}

/**
 * Saves a set of changed settings.
 *
 * Takes only what actually changed, so two people editing different categories
 * do not overwrite each other. Every change is validated against its
 * definition, written in one transaction, and recorded — with the old and new
 * values, because "the password policy was relaxed on Tuesday" is useless
 * without knowing what it was relaxed from.
 */
export async function updateSystemSettings(changes: Record<string, string>): Promise<Result> {
  const guard = await permit('settings:manage');
  if (!guard.ok) return guard.denied;
  const actor = guard.user;

  const entries = Object.entries(changes ?? {});
  if (entries.length === 0) return { success: true };

  // Validate everything before writing anything: a half-applied set of security
  // settings is worse than a rejected one.
  for (const [key, raw] of entries) {
    const definition = SETTINGS_BY_KEY.get(key);
    if (!definition) {
      return { success: false, error: `${key} is not a setting this system has.` };
    }
    const result = validate(definition, raw);
    if (!result.ok) return { success: false, error: result.error };
  }

  const before = await getSettings(true);

  try {
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value, updatedById: actor.id },
          create: { key, value, updatedById: actor.id },
        }),
      ),
    );
  } catch (error) {
    console.error('Failed to save settings:', error);
    return { success: false, error: 'Could not save the settings.' };
  }

  invalidateSettingsCache();
  const after = await getSettings(true);

  const changed = entries
    .map(([key]) => ({
      key,
      label: SETTINGS_BY_KEY.get(key)?.label ?? key,
      sensitive: Boolean(SETTINGS_BY_KEY.get(key)?.sensitive),
      from: before[key],
      to: after[key],
    }))
    // A save that submits an unchanged field should not read as a change.
    .filter((c) => String(c.from) !== String(c.to));

  if (changed.length > 0) {
    await auditAction(actor, {
      action: AUDIT_ACTIONS.SETTING_UPDATED,
      entity: 'Setting',
      entityId: changed.map((c) => c.key).join(','),
      details: {
        changes: changed,
        // Called out separately so a review can filter on it without parsing
        // the whole change list.
        includedSecurityControls: changed.some((c) => c.sensitive),
      },
    });
  }

  revalidatePath('/settings');
  return { success: true };
}

/** Puts one setting back to the value it ships with. */
export async function resetSystemSetting(key: string): Promise<Result> {
  const guard = await permit('settings:manage');
  if (!guard.ok) return guard.denied;

  const definition = SETTINGS_BY_KEY.get(key);
  if (!definition) return { success: false, error: `${key} is not a setting this system has.` };

  const before = await getSettings(true);
  await prisma.setting.deleteMany({ where: { key } });
  invalidateSettingsCache();

  await auditAction(guard.user, {
    action: AUDIT_ACTIONS.SETTING_UPDATED,
    entity: 'Setting',
    entityId: key,
    details: {
      reset: true,
      label: definition.label,
      from: before[key],
      to: definition.default,
      sensitive: Boolean(definition.sensitive),
    },
  });

  revalidatePath('/settings');
  return { success: true };
}
