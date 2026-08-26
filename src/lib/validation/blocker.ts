import { z } from 'zod';

/**
 * The issue register's rules.
 *
 * Kept beside the other validators rather than inline in the action, so the
 * same rules can be applied in the form and asserted in tests.
 */

export const BLOCKER_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const BLOCKER_CATEGORIES = [
  'RESOURCE',
  'TECHNICAL',
  'VENDOR',
  'FINANCIAL',
  'DEPENDENCY',
  'REGULATORY',
  'SCOPE',
  'OTHER',
] as const;

export const BLOCKER_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
] as const;

/** Severities serious enough that leaving them unowned is worth flagging. */
export const SERIOUS_SEVERITIES = ['HIGH', 'CRITICAL'] as const;

export const createBlockerSchema = z.object({
  title: z.string().trim().min(5, 'Give the issue a title of at least 5 characters.').max(120),
  description: z.string().trim().min(10, 'Describe the issue in at least 10 characters.').max(5000),
  category: z.enum(BLOCKER_CATEGORIES),
  severity: z.enum(BLOCKER_SEVERITIES),
  impact: z.string().trim().max(2000).optional().or(z.literal('')),
  ownerId: z.string().optional().or(z.literal('')),
  dueDate: z.coerce.date().optional().nullable(),
});

export const updateBlockerSchema = createBlockerSchema.partial().extend({
  status: z.enum(BLOCKER_STATUSES).optional(),
});

export const resolveBlockerSchema = z.object({
  resolution: z
    .string()
    .trim()
    .min(10, 'Say how it was resolved, in at least 10 characters.')
    .max(2000),
});

export const escalateBlockerSchema = z.object({
  escalatedToId: z.string().min(1, 'Choose who this is being escalated to.'),
  escalationReason: z
    .string()
    .trim()
    .min(10, 'Say why this needs escalating, in at least 10 characters.')
    .max(2000),
});

export type CreateBlockerInput = z.infer<typeof createBlockerSchema>;
export type UpdateBlockerInput = z.infer<typeof updateBlockerSchema>;

/**
 * Which status changes are allowed.
 *
 * A resolved issue can be reopened — that happens, and pretending otherwise
 * means people raise a duplicate instead, which loses the history. What is not
 * allowed is skipping from nothing to closed without a resolution, which the
 * action enforces separately.
 */
const TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ['IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'ESCALATED', 'RESOLVED', 'CLOSED'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN'],
  CLOSED: ['OPEN'],
};

export function canTransitionBlocker(from: string, to: string): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function blockerTransitionError(from: string, to: string): string {
  return `An issue that is ${from.toLowerCase().replace('_', ' ')} cannot be moved straight to ${to
    .toLowerCase()
    .replace('_', ' ')}.`;
}

/**
 * Whether an issue is still holding the project up.
 *
 * Resolved and closed both mean "no longer blocking", but they are not the same
 * thing and the register shows them differently — closed is an issue that went
 * away rather than one that was dealt with.
 */
export function isOpenBlocker(status: string): boolean {
  return status === 'OPEN' || status === 'IN_PROGRESS' || status === 'ESCALATED';
}

/** An issue nobody owns, or one that is serious with no date to clear it by. */
export function isUnmanaged(blocker: {
  status: string;
  severity: string;
  ownerId?: string | null;
  dueDate?: Date | string | null;
}): boolean {
  if (!isOpenBlocker(blocker.status)) return false;
  if (!blocker.ownerId) return true;
  return (SERIOUS_SEVERITIES as readonly string[]).includes(blocker.severity) && !blocker.dueDate;
}

/** Past its agreed clearance date and still open. */
export function isOverdueBlocker(
  blocker: { status: string; dueDate?: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (!isOpenBlocker(blocker.status) || !blocker.dueDate) return false;
  const due = blocker.dueDate instanceof Date ? blocker.dueDate : new Date(blocker.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  // Compared against the end of the due day: something due today is not late
  // until today is over.
  const endOfDue = new Date(due);
  endOfDue.setHours(23, 59, 59, 999);
  return now.getTime() > endOfDue.getTime();
}

export type EscalateBlockerInput = z.infer<typeof escalateBlockerSchema>;

/**
 * The statuses that mean "still blocking".
 *
 * Queries used to filter on `status: 'OPEN'`, which was complete when OPEN and
 * RESOLVED were the only two values. Now that an issue can be in progress or
 * escalated, that filter silently under-counts — an escalated critical issue
 * would drop out of the at-risk figures and stop blocking project closure,
 * which is precisely backwards.
 *
 * Use this in every `where` that asks whether a project is blocked.
 */
export const OPEN_BLOCKER_STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED'] as const;
