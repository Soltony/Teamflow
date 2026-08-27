/**
 * Three kinds of decision, one shape.
 *
 * Tasks, deadline changes and payments were three separate queues on three
 * separate screens, and the cost of that was not duplication — it was that
 * nobody could answer "what is waiting on me". A reviewer had to visit three
 * pages, each of which said nothing about the other two, and none of which
 * said how long anything had been sitting there.
 *
 * This is the common denominator: what is being asked, who asked, how long ago,
 * what approving does, and what rejecting does. Everything type-specific lives
 * in `context`, which the inbox renders inline so the decision can be made
 * without leaving the page.
 *
 * Pure types and pure SLA arithmetic, so the rules can be tested without a
 * database.
 */

export type ApprovalKind = 'task' | 'timeline' | 'payment';

export const APPROVAL_KIND_LABEL: Record<ApprovalKind, string> = {
  task: 'Task review',
  timeline: 'Deadline change',
  payment: 'Payment',
};

/** The permission a person needs to decide this kind of approval. */
export const APPROVAL_KIND_PERMISSION: Record<ApprovalKind, string> = {
  task: 'tasks:approve',
  timeline: 'timeline:approve',
  payment: 'payment-approvals:manage',
};

/** The permission a person needs merely to see the queue. */
export const APPROVAL_KIND_VIEW_PERMISSION: Record<ApprovalKind, string> = {
  task: 'tasks:approve',
  timeline: 'timeline:approve',
  payment: 'payment-approvals:view',
};

export type SlaState = 'ON_TIME' | 'DUE_SOON' | 'BREACHED';

/** One fact about the thing being approved, shown inline on the row. */
export interface ApprovalFact {
  label: string;
  value: string;
  /**
   * Draws the fact as a before → after pair, for changes rather than values.
   * The deadline change is the case that needs it.
   */
  from?: string;
}

export interface ApprovalItem {
  /** Unique across kinds: the inbox holds all three in one list. */
  id: string;
  kind: ApprovalKind;
  /** The underlying row's id, which the approve/reject actions take. */
  entityId: string;
  /** What is being decided, in one line. */
  title: string;
  /** Where it comes from. */
  projectId: string | null;
  projectName: string | null;
  /** Who is asking. */
  requestedByName: string | null;
  /** When it entered the queue. ISO. */
  submittedAt: string;
  /** The reason or justification the submitter gave, where there is one. */
  rationale: string | null;
  /** The facts a reviewer needs, so they need not open the record. */
  facts: ApprovalFact[];
  /** What approving will do. Stated before the decision, not after. */
  approveEffect: string;
  /** What rejecting will do, and who hears about it. */
  rejectEffect: string;
  /** Deep link to the full record, for the cases that need more. */
  href: string | null;
  /** Whether this reviewer may actually decide it, or only see it. */
  canDecide: boolean;
  /** Sorting weight for money: null for the kinds that have no amount. */
  amount: number | null;
  currency: string | null;
}

export interface SlaThresholds {
  /** Days before an approval is considered breached. */
  slaDays: number;
  /** Days before it is flagged as due soon. */
  warningDays: number;
}

export const DEFAULT_SLA: SlaThresholds = { slaDays: 3, warningDays: 2 };

/** Whole days an item has been waiting. Never negative. */
export function ageInDays(submittedAt: string | Date, now: Date = new Date()): number {
  const submitted = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) return 0;
  const ms = now.getTime() - submitted.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Where an item sits against the service level.
 *
 * Breach is `>=` the SLA rather than `>`: an approval with a three-day service
 * level has breached the moment the third day is complete, not a day later.
 * The warning line is clamped below the breach line so a misconfigured pair of
 * settings cannot produce a warning that fires after the breach.
 */
export function slaState(
  submittedAt: string | Date,
  thresholds: SlaThresholds = DEFAULT_SLA,
  now: Date = new Date(),
): SlaState {
  const age = ageInDays(submittedAt, now);
  const sla = Math.max(1, thresholds.slaDays);
  const warn = Math.min(Math.max(1, thresholds.warningDays), sla);

  if (age >= sla) return 'BREACHED';
  if (age >= warn) return 'DUE_SOON';
  return 'ON_TIME';
}

/** Days left before breach. Negative once breached. */
export function daysToBreach(
  submittedAt: string | Date,
  thresholds: SlaThresholds = DEFAULT_SLA,
  now: Date = new Date(),
): number {
  return Math.max(1, thresholds.slaDays) - ageInDays(submittedAt, now);
}

export type ApprovalSort = 'oldest' | 'newest' | 'sla' | 'amount' | 'project';

export const APPROVAL_SORT_OPTIONS: { value: ApprovalSort; label: string }[] = [
  { value: 'sla', label: 'Closest to breaching first' },
  { value: 'oldest', label: 'Longest waiting first' },
  { value: 'newest', label: 'Most recent first' },
  { value: 'amount', label: 'Largest amount first' },
  { value: 'project', label: 'Project, A to Z' },
];

const SLA_RANK: Record<SlaState, number> = { BREACHED: 0, DUE_SOON: 1, ON_TIME: 2 };

/** Orders an inbox without mutating it. Ties break on age, then on title. */
export function sortApprovals(
  items: ApprovalItem[],
  by: ApprovalSort,
  thresholds: SlaThresholds = DEFAULT_SLA,
  now: Date = new Date(),
): ApprovalItem[] {
  const age = (item: ApprovalItem) => ageInDays(item.submittedAt, now);
  const byAge = (a: ApprovalItem, b: ApprovalItem) => age(b) - age(a);
  const byTitle = (a: ApprovalItem, b: ApprovalItem) => a.title.localeCompare(b.title);

  return [...items].sort((a, b) => {
    switch (by) {
      case 'sla': {
        const rankA = SLA_RANK[slaState(a.submittedAt, thresholds, now)];
        const rankB = SLA_RANK[slaState(b.submittedAt, thresholds, now)];
        if (rankA !== rankB) return rankA - rankB;
        return byAge(a, b) || byTitle(a, b);
      }
      case 'newest':
        return age(a) - age(b) || byTitle(a, b);
      case 'amount': {
        // Items with no amount sort last rather than as zero: a task review is
        // not "the smallest payment".
        const amountA = a.amount ?? Number.NEGATIVE_INFINITY;
        const amountB = b.amount ?? Number.NEGATIVE_INFINITY;
        if (amountA !== amountB) return amountB - amountA;
        return byAge(a, b) || byTitle(a, b);
      }
      case 'project':
        return (a.projectName ?? '').localeCompare(b.projectName ?? '') || byTitle(a, b);
      case 'oldest':
      default:
        return byAge(a, b) || byTitle(a, b);
    }
  });
}

export interface InboxSummary {
  total: number;
  breached: number;
  dueSoon: number;
  byKind: Record<ApprovalKind, number>;
  /** Age of the longest-waiting item, in days. */
  oldestDays: number;
}

/** The counts the inbox header and the sidebar badge both read. */
export function summarizeInbox(
  items: ApprovalItem[],
  thresholds: SlaThresholds = DEFAULT_SLA,
  now: Date = new Date(),
): InboxSummary {
  const summary: InboxSummary = {
    total: items.length,
    breached: 0,
    dueSoon: 0,
    byKind: { task: 0, timeline: 0, payment: 0 },
    oldestDays: 0,
  };

  for (const item of items) {
    summary.byKind[item.kind] += 1;
    const state = slaState(item.submittedAt, thresholds, now);
    if (state === 'BREACHED') summary.breached += 1;
    else if (state === 'DUE_SOON') summary.dueSoon += 1;
    summary.oldestDays = Math.max(summary.oldestDays, ageInDays(item.submittedAt, now));
  }

  return summary;
}
