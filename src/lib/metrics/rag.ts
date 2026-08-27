/**
 * Red, amber, green — and the arithmetic behind it.
 *
 * "RAG status" is the thing executives actually read, and it is usually the
 * least defensible number on the page: assigned by hand, argued over in the
 * meeting, and impossible to reproduce a week later. This module derives it
 * from figures that already exist, states the rule in one place, and hands the
 * reasons back alongside the letter so the card can say *why* a project is red
 * rather than just colouring it.
 *
 * Two variances feed it, both expressed the way a PMO states them:
 *
 *  - **Schedule variance** — how far ahead or behind the plan the work is, in
 *    percentage points of completion. Negative is behind.
 *  - **Budget variance** — committed spend against the share of budget the
 *    elapsed schedule would justify. Negative is overspent.
 *
 * Pure, so both can be asserted in a test rather than eyeballed on a chart.
 */
import { projectProgress, type MilestoneLike } from './progress';
import { endOfDay, startOfDay } from './schedule';
import { isArchivedStatus, isClosedStatus, type StatusLike } from './status';

export type Rag = 'GREEN' | 'AMBER' | 'RED' | 'COMPLETE';

/**
 * The thresholds, in percentage points.
 *
 * Amber at 10 and red at 20 is the common PMO convention and is deliberately
 * not configurable per project — a threshold somebody can move is a threshold
 * that gets moved when the number is inconvenient.
 */
export const RAG_AMBER_THRESHOLD = 10;
export const RAG_RED_THRESHOLD = 20;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) ? n : 0;
};

export interface RagPaymentLike {
  amount?: unknown;
  status?: string | null;
}

export interface RagProjectLike {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  baselineStartDate?: Date | string | null;
  baselineEndDate?: Date | string | null;
  status?: StatusLike | null;
  milestones?: MilestoneLike[] | null;
  totalCost?: unknown;
  payments?: RagPaymentLike[] | null;
}

/**
 * How far through the project's window we are, 0–100.
 *
 * Measured against the *current* plan, because that is what the work is being
 * executed to. Whether the plan itself has moved is a separate question, and
 * `baselineSlipDays` in ./schedule answers it.
 */
export function elapsedSchedulePercent(
  project: RagProjectLike,
  now: Date = new Date(),
): number | null {
  const start = toDate(project.startDate);
  const end = toDate(project.endDate);
  if (!start || !end) return null;

  const from = startOfDay(start).getTime();
  const to = endOfDay(end).getTime();
  if (to <= from) return now.getTime() >= to ? 100 : 0;

  return Math.min(100, Math.max(0, ((now.getTime() - from) / (to - from)) * 100));
}

/**
 * Completion minus elapsed time, in percentage points.
 *
 * Positive means ahead of schedule, negative behind. Null when the project has
 * no window to measure against — a missing date is not the same as being on
 * schedule, and returning 0 would say it was.
 */
export function scheduleVariancePercent(
  project: RagProjectLike,
  now: Date = new Date(),
): number | null {
  const elapsed = elapsedSchedulePercent(project, now);
  if (elapsed === null) return null;
  return projectProgress({ milestones: project.milestones ?? [] }) - elapsed;
}

/** Money committed so far: approved payments, which are the ones that bind. */
export function committedSpend(project: RagProjectLike): number {
  return (project.payments ?? [])
    .filter((p) => p.status === 'APPROVED')
    .reduce((sum, p) => sum + toNumber(p.amount), 0);
}

/** Share of the budget already committed, 0–100. Null without a budget. */
export function budgetUsedPercent(project: RagProjectLike): number | null {
  const budget = toNumber(project.totalCost);
  if (budget <= 0) return null;
  return (committedSpend(project) / budget) * 100;
}

/**
 * Budget headroom against the elapsed schedule, in percentage points.
 *
 * The comparison that matters is not "have we spent more than the budget" —
 * by the time that is true it is far too late — but "have we spent more than
 * this far through the project would justify". Negative means overspent
 * relative to progress.
 *
 * Compared against *progress* rather than elapsed time, so a project that is
 * ahead of schedule is not punished for having spent the money that bought it.
 */
export function budgetVariancePercent(
  project: RagProjectLike,
  now: Date = new Date(),
): number | null {
  const used = budgetUsedPercent(project);
  if (used === null) return null;

  const progress = projectProgress({ milestones: project.milestones ?? [] });
  // Before any work is done, spend is not yet meaningful as a ratio; measure
  // against elapsed time instead so an early overspend still shows.
  const earned = progress > 0 ? progress : (elapsedSchedulePercent(project, now) ?? 0);
  return earned - used;
}

export interface RagAssessment {
  rag: Rag;
  /** Why it is that colour, worst first. Empty when green. */
  reasons: string[];
  scheduleVariance: number | null;
  budgetVariance: number | null;
  budgetUsed: number | null;
  progress: number;
  /** Days until the current deadline. Negative once passed. */
  daysRemaining: number | null;
}

/**
 * The project's RAG status and the reasons for it.
 *
 * A finished project is COMPLETE rather than green: "green" invites the reader
 * to think work is going well *now*, and nothing is going on at all.
 */
export function assessRag(
  project: RagProjectLike | null | undefined,
  now: Date = new Date(),
): RagAssessment {
  const empty: RagAssessment = {
    rag: 'GREEN',
    reasons: [],
    scheduleVariance: null,
    budgetVariance: null,
    budgetUsed: null,
    progress: 0,
    daysRemaining: null,
  };
  if (!project) return empty;

  const progress = projectProgress({ milestones: project.milestones ?? [] });
  const scheduleVariance = scheduleVariancePercent(project, now);
  const budgetVariance = budgetVariancePercent(project, now);
  const budgetUsed = budgetUsedPercent(project);

  const end = toDate(project.endDate);
  const daysRemaining = end
    ? Math.ceil((endOfDay(end).getTime() - now.getTime()) / MS_PER_DAY)
    : null;

  const base = { scheduleVariance, budgetVariance, budgetUsed, progress, daysRemaining };

  if (isClosedStatus(project.status ?? null)) {
    return { ...base, rag: 'COMPLETE', reasons: [] };
  }

  const reasons: string[] = [];
  let rag: Rag = 'GREEN';
  const worsen = (next: Rag) => {
    if (next === 'RED') rag = 'RED';
    else if (next === 'AMBER' && rag !== 'RED') rag = 'AMBER';
  };

  // Being open past the deadline is red on its own; no variance calculation
  // is going to make that acceptable.
  if (!isArchivedStatus(project.status ?? null) && daysRemaining !== null && daysRemaining < 0) {
    const late = Math.abs(daysRemaining);
    reasons.push(`Open ${late} day${late === 1 ? '' : 's'} past its deadline`);
    worsen('RED');
  }

  if (scheduleVariance !== null && scheduleVariance < 0) {
    const behind = Math.round(Math.abs(scheduleVariance));
    if (behind >= RAG_RED_THRESHOLD) {
      reasons.push(`${behind} points behind schedule`);
      worsen('RED');
    } else if (behind >= RAG_AMBER_THRESHOLD) {
      reasons.push(`${behind} points behind schedule`);
      worsen('AMBER');
    }
  }

  if (budgetVariance !== null && budgetVariance < 0) {
    const over = Math.round(Math.abs(budgetVariance));
    if (over >= RAG_RED_THRESHOLD) {
      reasons.push(`${over} points of budget ahead of delivery`);
      worsen('RED');
    } else if (over >= RAG_AMBER_THRESHOLD) {
      reasons.push(`${over} points of budget ahead of delivery`);
      worsen('AMBER');
    }
  }

  return { ...base, rag, reasons };
}

export interface PortfolioRag {
  green: number;
  amber: number;
  red: number;
  complete: number;
  total: number;
  /** Mean schedule variance across projects that have one. */
  averageScheduleVariance: number | null;
  /** Mean budget variance across projects that have one. */
  averageBudgetVariance: number | null;
}

/** The RAG spread across a set of projects, for the portfolio header. */
export function summarizeRag(
  projects: RagProjectLike[],
  now: Date = new Date(),
): PortfolioRag {
  const counts: PortfolioRag = {
    green: 0,
    amber: 0,
    red: 0,
    complete: 0,
    total: projects.length,
    averageScheduleVariance: null,
    averageBudgetVariance: null,
  };

  const schedule: number[] = [];
  const budget: number[] = [];

  for (const project of projects) {
    const assessment = assessRag(project, now);
    if (assessment.rag === 'RED') counts.red += 1;
    else if (assessment.rag === 'AMBER') counts.amber += 1;
    else if (assessment.rag === 'COMPLETE') counts.complete += 1;
    else counts.green += 1;

    if (assessment.scheduleVariance !== null) schedule.push(assessment.scheduleVariance);
    if (assessment.budgetVariance !== null) budget.push(assessment.budgetVariance);
  }

  const mean = (values: number[]) =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  counts.averageScheduleVariance = mean(schedule);
  counts.averageBudgetVariance = mean(budget);
  return counts;
}
