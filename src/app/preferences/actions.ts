'use server';

import { z } from 'zod';

import prisma from '@/lib/db';
import { requireUser } from '@/lib/auth/guard';

/**
 * How one person likes a table arranged.
 *
 * Stored against the user rather than in the browser, so the choice follows
 * them between machines — somebody who sets up the project table on a desktop
 * should not find it reset on a laptop.
 *
 * Deliberately permissive on read: the stored shape is owned by whichever table
 * saved it, and columns get added and renamed. A preference row that no longer
 * parses is discarded in favour of the table's defaults rather than throwing,
 * because a stale layout must never be able to stop a page rendering.
 */

const preferenceSchema = z.object({
  /** Column ids, in display order. */
  columns: z.array(z.string().max(64)).max(64).optional(),
  sort: z
    .object({
      column: z.string().max(64),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
  /** Saved view name → filter values, for tables that support them. */
  filters: z.record(z.string().max(64), z.string().max(256)).optional(),
});

export type TablePreferences = z.infer<typeof preferenceSchema>;

const KEY = z.string().min(1).max(64);

/** The reader's saved layout for one table, or null if they have none. */
export async function getTablePreferences(tableKey: string): Promise<TablePreferences | null> {
  const user = await requireUser();
  const key = KEY.safeParse(tableKey);
  if (!key.success) return null;

  const row = await prisma.tablePreference.findUnique({
    where: { userId_tableKey: { userId: user.id, tableKey: key.data } },
    select: { preferences: true },
  });
  if (!row) return null;

  const parsed = preferenceSchema.safeParse(row.preferences);
  // A row written by an older version of the table is not an error; it is just
  // out of date. Fall back to defaults rather than failing the page.
  return parsed.success ? parsed.data : null;
}

/** Saves the reader's layout for one table. Silently ignores an invalid shape. */
export async function saveTablePreferences(
  tableKey: string,
  preferences: unknown,
): Promise<{ success: boolean }> {
  const user = await requireUser();
  const key = KEY.safeParse(tableKey);
  const parsed = preferenceSchema.safeParse(preferences);
  if (!key.success || !parsed.success) return { success: false };

  await prisma.tablePreference.upsert({
    where: { userId_tableKey: { userId: user.id, tableKey: key.data } },
    create: { userId: user.id, tableKey: key.data, preferences: parsed.data },
    update: { preferences: parsed.data },
  });

  return { success: true };
}
