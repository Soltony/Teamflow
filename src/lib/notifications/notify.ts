import type { Prisma, PrismaClient } from '@prisma/client';

import prisma from '@/lib/db';
import { buildNotificationRows, type NotificationDraft } from './recipients';

/**
 * Sending one notification to many people.
 *
 * Every fan-out in the application used to be a `for` loop around
 * `notification.create`, which is one round trip per recipient inside the
 * request the user is waiting on. Approving a task for a team of twelve was
 * twelve sequential inserts; a project-wide announcement was worse, and the
 * cost grew exactly as the organisation grew.
 *
 * `createMany` makes it one statement regardless of headcount. The loops also
 * disagreed with each other about whether to skip the actor and whether to
 * deduplicate — that logic now lives in one pure module beside this one.
 */

/** Accepts both the singleton client and a transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Notifies everyone in `candidateIds` except the sender.
 *
 * Returns the number of rows written, which is what the tests assert on:
 * "three assignees, one of them the reviewer, so two notifications".
 */
export async function notifyMany(
  db: Db,
  draft: NotificationDraft,
  candidateIds: Iterable<string>,
): Promise<number> {
  const rows = buildNotificationRows(draft, candidateIds);
  // Skip the round trip entirely when the only candidate was the actor.
  if (rows.length === 0) return 0;

  const result = await db.notification.createMany({ data: rows });
  return result.count;
}

/** The single-recipient case, kept here so call sites have one import. */
export async function notifyOne(
  db: Db,
  draft: NotificationDraft,
  recipientId: string,
): Promise<number> {
  return notifyMany(db, draft, [recipientId]);
}

/** Convenience wrapper for the common case of using the singleton client. */
export async function notify(
  draft: NotificationDraft,
  candidateIds: Iterable<string>,
): Promise<number> {
  return notifyMany(prisma, draft, candidateIds);
}
