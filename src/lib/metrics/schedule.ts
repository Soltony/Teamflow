/**
 * Schedule performance.
 *
 * One definition of each concept, because there were previously three of
 * "on-time" and two of "overdue" across four screens, and the same portfolio
 * produced different numbers depending on which page you opened:
 *
 *  - The dashboard compared the latest *planned* task end date to the project
 *    end date, which measures the plan against itself and never looks at what
 *    actually happened.
 *  - The CEO report compared the latest *actual* completedAt.
 *  - The division-performance table did the same but substituted `new Date(0)`
 *    for tasks that were never completed. Taken as a maximum, that made
 *    unfinished work invisible, so a project with outstanding tasks scored as
 *    delivered on time.
 *
 * The rules below are the ones the figures now mean. They are stated here so
 * they can be quoted in a tooltip and defended in a meeting.
 */
import { isClosedStatus, isLiveStatus, type StatusLike } from './status';

export interface TaskScheduleLike {
  endDate: Date | string;
  completedAt?: Date | string | null;
}

export interface MilestoneScheduleLike {
  tasks?: TaskScheduleLike[] | null;
}

export interface ProjectScheduleLike {
  endDate: Date | string;
  baselineEndDate?: Date | string | null;
  status?: StatusLike | null;
  milestones?: MilestoneScheduleLike[] | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * End of the given day, so a deadline of the 30th is not missed at 00:01 on
 * the 30th. Applied consistently — the two previous "overdue" checks disagreed
 * by a full day because only one of them did this.
 */
export function endOfDay(value: Date | string): Date {
  const date = toDate(value)!;
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Midnight at the start of the day.
 *
 * Day-count metrics compare calendar dates, not instants: "ten days late" must
 * not become eleven because the deadline is held as 23:59 and the completion
 * timestamp as 00:00. Comparisons that decide *whether* something is late
 * still use endOfDay, so finishing at 18:00 on the due date counts as on time.
 */
export function startOfDay(value: Date | string): Date {
  const date = toDate(value)!;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Whole calendar days between two dates, ignoring the time of day. */
function calendarDaysBetween(from: Date | string, to: Date | string): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/**
 * The deadline a project is judged against: its original commitment where one
 * exists, otherwise the current plan.
 *
 * Using the current end date alone is what made extensions unmeasurable.
 */
export function deadlineFor(project: ProjectScheduleLike): Date {
  return endOfDay(project.baselineEndDate ?? project.endDate);
}

const allTasks = (project: ProjectScheduleLike): TaskScheduleLike[] =>
  (project.milestones ?? []).flatMap((m) => m.tasks ?? []);

/**
 * When the work actually finished, or null if any of it has not.
 *
 * Returning null rather than a sentinel date is the whole point: a project with
 * an unfinished task has no completion date, and must not be scored as if it
 * finished at the epoch.
 */
export function actualCompletionDate(project: ProjectScheduleLike): Date | null {
  const tasks = allTasks(project);
  if (tasks.length === 0) return null;

  let latest: Date | null = null;
  for (const task of tasks) {
    const completed = toDate(task.completedAt ?? null);
    if (!completed) return null; // outstanding work
    if (!latest || completed > latest) latest = completed;
  }
  return latest;
}

/**
 * Delivered on or before the committed deadline.
 *
 * A project only qualifies when its status says it is closed *and* every task
 * carries a completion date. A closed project with no tasks at all counts as
 * on time — there was nothing to be late with — but a closed project with
 * unfinished tasks does not.
 */
export function isOnTime(project: ProjectScheduleLike): boolean {
  if (!isClosedStatus(project.status)) return false;

  const tasks = allTasks(project);
  if (tasks.length === 0) return true;

  const completed = actualCompletionDate(project);
  if (!completed) return false;

  return completed.getTime() <= deadlineFor(project).getTime();
}

/** Closed, but delivered after the committed deadline. */
export function isLate(project: ProjectScheduleLike): boolean {
  return isClosedStatus(project.status) && !isOnTime(project);
}

/**
 * Still running and past its deadline.
 *
 * A finished project is never "overdue" — it is on time or late — so this only
 * considers live statuses.
 */
export function isOverdue(project: ProjectScheduleLike, now: Date = new Date()): boolean {
  if (!isLiveStatus(project.status)) return false;
  return now.getTime() > endOfDay(project.endDate).getTime();
}

/**
 * Days late against the original commitment. Negative means early.
 *
 * Null when the project has not finished, since variance against an unknown
 * completion date is not a number.
 */
export function scheduleVarianceDays(project: ProjectScheduleLike): number | null {
  const completed = actualCompletionDate(project);
  if (!completed || !isClosedStatus(project.status)) return null;
  return calendarDaysBetween(deadlineFor(project), completed);
}

/**
 * Days the current plan has slipped from the baseline. Zero when never
 * extended; null when no baseline was captured.
 */
export function baselineSlipDays(project: ProjectScheduleLike): number | null {
  const baseline = toDate(project.baselineEndDate ?? null);
  if (!baseline) return null;
  return calendarDaysBetween(baseline, project.endDate);
}

/** Days until the current deadline. Negative once it has passed. */
export function daysRemaining(project: ProjectScheduleLike, now: Date = new Date()): number {
  return Math.ceil((endOfDay(project.endDate).getTime() - now.getTime()) / MS_PER_DAY);
}

export interface PortfolioScheduleSummary {
  total: number;
  closed: number;
  onTime: number;
  late: number;
  overdue: number;
  /** Share of *closed* projects delivered on time, 0–100. */
  onTimeRate: number;
}

/**
 * Portfolio roll-up. Every screen showing these counts should call this rather
 * than filtering itself, so a card and the report behind it cannot disagree.
 */
export function summarizeSchedule(
  projects: ProjectScheduleLike[],
  now: Date = new Date(),
): PortfolioScheduleSummary {
  const closed = projects.filter((p) => isClosedStatus(p.status));
  const onTime = closed.filter(isOnTime).length;

  return {
    total: projects.length,
    closed: closed.length,
    onTime,
    late: closed.length - onTime,
    overdue: projects.filter((p) => isOverdue(p, now)).length,
    onTimeRate: closed.length > 0 ? (onTime / closed.length) * 100 : 0,
  };
}
