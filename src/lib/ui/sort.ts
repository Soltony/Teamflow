/**
 * Sorting, defined once.
 *
 * Nothing in this system could be sorted at all: every list came back in
 * whatever order the query produced, which for projects was insertion order.
 * A portfolio manager looking for what is slipping had to read all of it.
 *
 * The options are deliberately few and named for what somebody is looking for
 * ("Most at risk") rather than for the column they happen to be implemented
 * against ("risk_severity desc"). Pure, so the ordering can be asserted in a
 * test rather than eyeballed.
 */
import { milestoneProgress, projectProgress } from '@/lib/metrics/progress';
import { milestoneHealth, worstRisk, type DatedWorkLike, type RiskProjectLike } from './health';

export type ProjectSort = 'risk' | 'deadline' | 'progress' | 'name' | 'recent';

export const PROJECT_SORT_OPTIONS: { value: ProjectSort; label: string }[] = [
  { value: 'risk', label: 'Most at risk' },
  { value: 'deadline', label: 'Deadline, soonest first' },
  { value: 'progress', label: 'Least progress first' },
  { value: 'name', label: 'Name, A to Z' },
  { value: 'recent', label: 'Recently updated' },
];

const time = (value: Date | string | null | undefined): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
};

const RISK_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export interface SortableProject extends RiskProjectLike {
  id?: string;
  name?: string | null;
  updatedAt?: Date | string | null;
}

/**
 * Orders a list of projects without mutating it.
 *
 * Ties break on name so the order is stable between renders — a list that
 * reshuffles itself when an unrelated field changes is worse than an
 * unsorted one.
 */
export function sortProjects<T extends SortableProject>(
  projects: T[],
  by: ProjectSort,
  now: Date = new Date(),
): T[] {
  const byName = (a: T, b: T) => (a.name ?? '').localeCompare(b.name ?? '');

  return [...projects].sort((a, b) => {
    switch (by) {
      case 'risk': {
        const ra = worstRisk(a, now);
        const rb = worstRisk(b, now);
        // No risk at all sorts last, not first: this view is for finding
        // trouble, and a healthy project is not the answer to that question.
        const rankA = ra ? RISK_RANK[ra.severity] : 99;
        const rankB = rb ? RISK_RANK[rb.severity] : 99;
        if (rankA !== rankB) return rankA - rankB;
        return time(a.endDate) - time(b.endDate) || byName(a, b);
      }
      case 'deadline':
        return time(a.endDate) - time(b.endDate) || byName(a, b);
      case 'progress': {
        const pa = projectProgress({ milestones: a.milestones ?? [] });
        const pb = projectProgress({ milestones: b.milestones ?? [] });
        return pa - pb || byName(a, b);
      }
      case 'recent':
        return time(b.updatedAt) - time(a.updatedAt) || byName(a, b);
      case 'name':
      default:
        return byName(a, b);
    }
  });
}

export type MilestoneSort = 'health' | 'due' | 'progress' | 'title';

export const MILESTONE_SORT_OPTIONS: { value: MilestoneSort; label: string }[] = [
  { value: 'health', label: 'Needs attention first' },
  { value: 'due', label: 'Due date, soonest first' },
  { value: 'progress', label: 'Least progress first' },
  { value: 'title', label: 'Title, A to Z' },
];

/** Worst news first, which is the order a status meeting reads them in. */
const HEALTH_RANK: Record<string, number> = {
  OVERDUE: 0,
  AT_RISK: 1,
  NOT_STARTED: 2,
  ON_TRACK: 3,
  COMPLETE: 4,
};

export interface SortableMilestone extends DatedWorkLike {
  id?: string;
  title?: string | null;
}

export function sortMilestones<T extends SortableMilestone>(
  milestones: T[],
  by: MilestoneSort,
  now: Date = new Date(),
): T[] {
  const byTitle = (a: T, b: T) => (a.title ?? '').localeCompare(b.title ?? '');

  return [...milestones].sort((a, b) => {
    switch (by) {
      case 'health': {
        const ha = HEALTH_RANK[milestoneHealth(a, now)] ?? 9;
        const hb = HEALTH_RANK[milestoneHealth(b, now)] ?? 9;
        if (ha !== hb) return ha - hb;
        return time(a.dueDate ?? a.endDate) - time(b.dueDate ?? b.endDate) || byTitle(a, b);
      }
      case 'progress':
        return milestoneProgress(a) - milestoneProgress(b) || byTitle(a, b);
      case 'title':
        return byTitle(a, b);
      case 'due':
      default:
        return time(a.dueDate ?? a.endDate) - time(b.dueDate ?? b.endDate) || byTitle(a, b);
    }
  });
}

export type TaskSort = 'due' | 'status' | 'progress' | 'title';

export const TASK_SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: 'due', label: 'Due date, soonest first' },
  { value: 'status', label: 'Status' },
  { value: 'progress', label: 'Least progress first' },
  { value: 'title', label: 'Title, A to Z' },
];

/** Work you can act on before work you cannot. */
const TASK_STATUS_RANK: Record<string, number> = {
  IN_PROGRESS: 0,
  PENDING_REVIEW: 1,
  TODO: 2,
  DONE: 3,
};

export interface SortableTask {
  title?: string | null;
  status?: string | null;
  progress?: number | null;
  endDate?: Date | string | null;
}

export function sortTasks<T extends SortableTask>(tasks: T[], by: TaskSort): T[] {
  const byTitle = (a: T, b: T) => (a.title ?? '').localeCompare(b.title ?? '');

  return [...tasks].sort((a, b) => {
    switch (by) {
      case 'status': {
        const sa = TASK_STATUS_RANK[String(a.status ?? '')] ?? 9;
        const sb = TASK_STATUS_RANK[String(b.status ?? '')] ?? 9;
        if (sa !== sb) return sa - sb;
        return time(a.endDate) - time(b.endDate) || byTitle(a, b);
      }
      case 'progress':
        return Number(a.progress ?? 0) - Number(b.progress ?? 0) || byTitle(a, b);
      case 'title':
        return byTitle(a, b);
      case 'due':
      default:
        return time(a.endDate) - time(b.endDate) || byTitle(a, b);
    }
  });
}
