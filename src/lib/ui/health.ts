/**
 * Whether a piece of work is going to make it.
 *
 * Progress alone does not answer that question. A milestone at 40% is fine in
 * week one and a crisis in the final week, and every screen in this system was
 * showing the bar without the context that makes it mean something — so a
 * project detail page could show four healthy-looking milestones, two of which
 * were already past their due date.
 *
 * The rule is a comparison against elapsed time: how far through the window
 * are we, versus how far through the work. Pure, so it can be tested and used
 * identically on a card, in a table, and in a roll-up.
 */
import { milestoneProgress, projectProgress } from '@/lib/metrics/progress';
import { isArchivedStatus, isClosedStatus, type StatusLike } from '@/lib/metrics/status';
import { endOfDay, startOfDay } from '@/lib/metrics/schedule';

export type Health = 'COMPLETE' | 'OVERDUE' | 'AT_RISK' | 'ON_TRACK' | 'NOT_STARTED';

/**
 * How far behind schedule the work must fall before it is "at risk", in
 * percentage points.
 *
 * Fifteen points is roughly a week's slip on a two-month milestone. Lower and
 * every milestone flickers amber the moment somebody takes a day off; higher
 * and nothing is flagged until it is already too late to act.
 */
export const AT_RISK_TOLERANCE = 15;

/** A deadline this close counts as "due soon" for the attention lists. */
export const DUE_SOON_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DatedWorkLike {
  startDate?: Date | string | null;
  /** Milestones call it dueDate; projects and tasks call it endDate. */
  dueDate?: Date | string | null;
  endDate?: Date | string | null;
  weight?: number | null;
  tasks?: { weight?: number | null; progress?: number | null; status?: string | null }[] | null;
}

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const deadlineOf = (work: DatedWorkLike): Date | null =>
  toDate(work.dueDate ?? work.endDate ?? null);

/**
 * The share of the window that has elapsed, 0–100.
 *
 * Null when there is no window to measure against — a milestone with no start
 * date cannot be judged as behind, and guessing would be worse than saying
 * nothing. Windows that start in the future read 0; ones that have closed
 * read 100.
 */
export function elapsedPercent(work: DatedWorkLike, now: Date = new Date()): number | null {
  const start = toDate(work.startDate ?? null);
  const end = deadlineOf(work);
  if (!start || !end) return null;

  const from = startOfDay(start).getTime();
  const to = endOfDay(end).getTime();
  if (to <= from) return now.getTime() >= to ? 100 : 0;

  const ratio = ((now.getTime() - from) / (to - from)) * 100;
  return Math.min(100, Math.max(0, ratio));
}

/**
 * How many points behind schedule the work is. Negative means ahead.
 *
 * Null when the window is unknown, for the same reason as above.
 */
export function scheduleGap(work: DatedWorkLike, now: Date = new Date()): number | null {
  const elapsed = elapsedPercent(work, now);
  if (elapsed === null) return null;
  return elapsed - milestoneProgress(work);
}

/**
 * A milestone's health.
 *
 * Order matters: finished beats late, and late beats behind. A milestone that
 * is complete is never overdue, however long it took — that is what the
 * schedule-variance figure is for.
 */
export function milestoneHealth(work: DatedWorkLike, now: Date = new Date()): Health {
  const progress = milestoneProgress(work);
  if (progress >= 100) return 'COMPLETE';

  const end = deadlineOf(work);
  if (end && now.getTime() > endOfDay(end).getTime()) return 'OVERDUE';

  if (progress <= 0) {
    // Unstarted is only worth distinguishing while there is still time; once
    // the window is half gone it is a schedule problem, not a status.
    const elapsed = elapsedPercent(work, now);
    if (elapsed === null || elapsed < 50) return 'NOT_STARTED';
    return 'AT_RISK';
  }

  const gap = scheduleGap(work, now);
  if (gap !== null && gap > AT_RISK_TOLERANCE) return 'AT_RISK';

  return 'ON_TRACK';
}

/** Whole days until the deadline. Negative once it has passed. */
export function daysUntil(work: DatedWorkLike, now: Date = new Date()): number | null {
  const end = deadlineOf(work);
  if (!end) return null;
  return Math.ceil((endOfDay(end).getTime() - now.getTime()) / MS_PER_DAY);
}

export interface HealthCounts {
  complete: number;
  onTrack: number;
  notStarted: number;
  atRisk: number;
  overdue: number;
  total: number;
}

/** Roll-up of a project's milestones, for the summary cards. */
export function summarizeMilestoneHealth(
  milestones: DatedWorkLike[] | null | undefined,
  now: Date = new Date(),
): HealthCounts {
  const counts: HealthCounts = {
    complete: 0,
    onTrack: 0,
    notStarted: 0,
    atRisk: 0,
    overdue: 0,
    total: 0,
  };

  for (const milestone of milestones ?? []) {
    counts.total += 1;
    switch (milestoneHealth(milestone, now)) {
      case 'COMPLETE':
        counts.complete += 1;
        break;
      case 'OVERDUE':
        counts.overdue += 1;
        break;
      case 'AT_RISK':
        counts.atRisk += 1;
        break;
      case 'NOT_STARTED':
        counts.notStarted += 1;
        break;
      default:
        counts.onTrack += 1;
    }
  }

  return counts;
}

export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface RiskIndicator {
  id: string;
  severity: RiskSeverity;
  /** The headline, in the reader's terms. */
  label: string;
  /** Why it is a risk — one line, concrete. */
  detail: string;
  /** Which section of the project to go and deal with it in. */
  section?: string;
}

export interface RiskBlockerLike {
  status?: string | null;
  severity?: string | null;
  dueDate?: string | null;
  ownerId?: string | null;
}

export interface RiskProjectLike {
  endDate?: Date | string | null;
  baselineEndDate?: Date | string | null;
  status?: StatusLike | null;
  milestones?: DatedWorkLike[] | null;
  blockers?: RiskBlockerLike[] | null;
}

const OPEN_BLOCKER: ReadonlySet<string> = new Set(['OPEN', 'IN_PROGRESS', 'ESCALATED']);

/**
 * Everything about this project that somebody ought to know before they look
 * at the progress bar, worst first.
 *
 * Returns an empty list when there is genuinely nothing wrong — a "no risks"
 * panel is worth showing, but only when the check actually ran.
 */
export function projectRisks(
  project: RiskProjectLike | null | undefined,
  now: Date = new Date(),
): RiskIndicator[] {
  if (!project) return [];

  const risks: RiskIndicator[] = [];
  const milestones = project.milestones ?? [];
  const blockers = project.blockers ?? [];
  const archived = isArchivedStatus(project.status ?? null);

  // Schedule. A closed or handed-over project is not "running late"; whether it
  // was delivered late is a different question, answered by the metrics module.
  if (!archived && project.endDate) {
    const days = Math.ceil((endOfDay(project.endDate).getTime() - now.getTime()) / MS_PER_DAY);
    const progress = projectProgress({ milestones });

    if (days < 0) {
      const late = Math.abs(days);
      risks.push({
        id: 'project-overdue',
        severity: 'critical',
        label: 'Past its deadline',
        detail: `The deadline passed ${late} day${late === 1 ? '' : 's'} ago and the project is still open.`,
      });
    } else if (days <= DUE_SOON_DAYS && progress < 100) {
      risks.push({
        id: 'project-due-soon',
        severity: 'warning',
        label: `Due in ${days} day${days === 1 ? '' : 's'}`,
        detail: `Delivery is ${Math.round(progress)}% complete with the deadline this week.`,
      });
    }
  }

  const health = summarizeMilestoneHealth(milestones, now);
  if (health.overdue > 0) {
    risks.push({
      id: 'milestones-overdue',
      severity: 'critical',
      label: `${health.overdue} milestone${health.overdue === 1 ? '' : 's'} overdue`,
      detail: 'Work is past its due date and not finished.',
      section: 'milestones',
    });
  }
  if (health.atRisk > 0) {
    risks.push({
      id: 'milestones-at-risk',
      severity: 'warning',
      label: `${health.atRisk} milestone${health.atRisk === 1 ? '' : 's'} behind schedule`,
      detail: `Progress trails elapsed time by more than ${AT_RISK_TOLERANCE} points.`,
      section: 'milestones',
    });
  }

  const openBlockers = blockers.filter((b) => OPEN_BLOCKER.has(String(b.status ?? '')));
  const serious = openBlockers.filter(
    (b) => b.severity === 'HIGH' || b.severity === 'CRITICAL',
  );
  if (serious.length > 0) {
    risks.push({
      id: 'blockers-serious',
      severity: 'critical',
      label: `${serious.length} serious issue${serious.length === 1 ? '' : 's'} open`,
      detail: 'High or critical issues are unresolved and holding work up.',
      section: 'blockers',
    });
  } else if (openBlockers.length > 0) {
    risks.push({
      id: 'blockers-open',
      severity: 'warning',
      label: `${openBlockers.length} open issue${openBlockers.length === 1 ? '' : 's'}`,
      detail: 'Raised and not yet resolved.',
      section: 'blockers',
    });
  }

  const unowned = openBlockers.filter((b) => !b.ownerId);
  if (unowned.length > 0) {
    risks.push({
      id: 'blockers-unowned',
      severity: 'warning',
      label: `${unowned.length} issue${unowned.length === 1 ? '' : 's'} with no owner`,
      detail: 'Nobody is accountable for clearing these.',
      section: 'blockers',
    });
  }

  // A plan that has already moved is worth stating plainly, since progress is
  // measured against the current dates and quietly looks better after a slip.
  const baseline = toDate(project.baselineEndDate ?? null);
  const current = toDate(project.endDate ?? null);
  if (baseline && current) {
    const slip = Math.round(
      (startOfDay(current).getTime() - startOfDay(baseline).getTime()) / MS_PER_DAY,
    );
    if (slip > 0) {
      risks.push({
        id: 'baseline-slip',
        severity: 'info',
        label: `Deadline extended by ${slip} day${slip === 1 ? '' : 's'}`,
        detail: 'The current plan has moved from the original commitment.',
        section: 'timeline',
      });
    }
  }

  if (!archived && milestones.length === 0) {
    risks.push({
      id: 'no-milestones',
      severity: 'info',
      label: 'No milestones planned',
      detail: 'Progress cannot be tracked until the work is broken down.',
      section: 'milestones',
    });
  }

  const order: Record<RiskSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return risks.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** The single worst thing about a project, for a badge on a card or a row. */
export function worstRisk(
  project: RiskProjectLike | null | undefined,
  now: Date = new Date(),
): RiskIndicator | null {
  return projectRisks(project, now)[0] ?? null;
}

/** Whether a project is finished, for screens that show a "done" treatment. */
export function isProjectComplete(project: RiskProjectLike | null | undefined): boolean {
  return isClosedStatus(project?.status ?? null);
}
