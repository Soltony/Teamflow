/**
 * How much of a person is already committed.
 *
 * Team membership answers "who is in this group". It has never answered "is
 * this person already full", which is the question that decides whether a plan
 * is deliverable. A person on four projects at 100% each is not a scheduling
 * detail — it is the reason the fourth one slips.
 *
 * Pure, like the rest of lib/metrics: no Prisma, no React.
 */

export interface AssignmentLike {
  userId: string;
  projectId: string;
  allocationPct: number;
  /** Null means "for the life of the project". */
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Whether an assignment is live on a given day.
 *
 * An absent bound is open-ended, not zero: an assignment with no end date runs
 * until somebody ends it, and treating that as "not active" would make most of
 * the register invisible.
 */
export function isActiveOn(assignment: AssignmentLike, day: Date): boolean {
  const start = toDate(assignment.startDate);
  const end = toDate(assignment.endDate);
  const t = day.getTime();
  if (start && t < startOfDay(start).getTime()) return false;
  if (end && t > endOfDay(end).getTime()) return false;
  return true;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/** Total percentage committed for one person on a given day. */
export function totalAllocation(
  assignments: AssignmentLike[],
  userId: string,
  day: Date = new Date(),
): number {
  return assignments
    .filter((a) => a.userId === userId && isActiveOn(a, day))
    .reduce((sum, a) => sum + (Number.isFinite(a.allocationPct) ? a.allocationPct : 0), 0);
}

export interface AllocationSummary {
  userId: string;
  /** Percentage of a working week already committed. */
  totalPct: number;
  /** How many projects that is spread across. */
  projectCount: number;
  /** Committed beyond a full week. */
  isOverAllocated: boolean;
  /** Committed to less than a full week. */
  hasSpareCapacity: boolean;
}

/**
 * One row per person, for a capacity view.
 *
 * Anyone with no active assignment is absent rather than reported at zero:
 * the caller knows its own population, and inventing rows here would make the
 * summary disagree with whichever list it was built from.
 */
export function summarizeAllocation(
  assignments: AssignmentLike[],
  day: Date = new Date(),
): AllocationSummary[] {
  const byUser = new Map<string, { total: number; projects: Set<string> }>();

  for (const a of assignments) {
    if (!isActiveOn(a, day)) continue;
    const entry = byUser.get(a.userId) ?? { total: 0, projects: new Set<string>() };
    entry.total += Number.isFinite(a.allocationPct) ? a.allocationPct : 0;
    entry.projects.add(a.projectId);
    byUser.set(a.userId, entry);
  }

  return [...byUser.entries()]
    .map(([userId, { total, projects }]) => ({
      userId,
      totalPct: total,
      projectCount: projects.size,
      isOverAllocated: total > 100,
      hasSpareCapacity: total < 100,
    }))
    // Most over-committed first: that is what a capacity view is read for.
    .sort((a, b) => b.totalPct - a.totalPct);
}

/**
 * What is left of a person's week.
 *
 * Clamped at zero: somebody committed to 140% has no negative capacity, they
 * have none at all, and reporting -40 invites it being added to a total.
 */
export function remainingCapacity(
  assignments: AssignmentLike[],
  userId: string,
  day: Date = new Date(),
): number {
  return Math.max(0, 100 - totalAllocation(assignments, userId, day));
}
