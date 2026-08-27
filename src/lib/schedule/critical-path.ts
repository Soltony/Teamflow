/**
 * Which tasks cannot slip without moving the end date.
 *
 * The critical path is the longest chain of dependent work through a plan.
 * Everything on it has zero float: delay any one task by a day and the project
 * finishes a day later. Everything off it has slack, and knowing how much is
 * the difference between "we are late" and "we are late *because of this*".
 *
 * This is the standard forward/backward pass, done on calendar days rather
 * than working days — the rest of this system reasons in calendar days
 * (deadlines are dates, not effort), and mixing the two silently is how
 * schedule tools end up disagreeing with the dates on screen.
 *
 * Pure and dependency-free so it can be unit tested and run on either side.
 */

export type DependencyType =
  | 'FINISH_TO_START'
  | 'START_TO_START'
  | 'FINISH_TO_FINISH'
  | 'START_TO_FINISH';

export interface ScheduleTask {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
}

export interface ScheduleLink {
  predecessorId: string;
  successorId: string;
  type?: DependencyType | null;
  lagDays?: number | null;
}

export interface TaskFloat {
  id: string;
  /** Earliest the task can start, in days from the plan's start. */
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  /** Days it can slip without moving the project end. Zero means critical. */
  totalFloat: number;
  isCritical: boolean;
}

export interface CriticalPathResult {
  /** Float for every task, keyed by id. */
  floats: Map<string, TaskFloat>;
  /** Ids on the critical path, in schedule order. */
  criticalPath: string[];
  /** Length of the plan in days. */
  duration: number;
  /**
   * Links that could not be honoured because they form a cycle.
   *
   * Reported rather than thrown: a cycle is a data problem the planner needs
   * to see and fix, and refusing to draw the chart at all helps nobody find
   * it. The cycle's links are ignored for the calculation.
   */
  cyclicLinks: ScheduleLink[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

const dayOf = (value: Date | string, origin: number): number =>
  Math.round((toDate(value).setHours(0, 0, 0, 0) - origin) / MS_PER_DAY);

/**
 * Orders tasks so every predecessor comes before its successors.
 *
 * Kahn's algorithm. Anything still holding an incoming edge when the queue
 * empties is part of a cycle, which is how cycles are detected without a
 * separate pass.
 */
function topologicalOrder(
  ids: string[],
  links: ScheduleLink[],
): { order: string[]; cyclic: Set<string> } {
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const link of links) {
    if (!incoming.has(link.successorId) || !outgoing.has(link.predecessorId)) continue;
    incoming.set(link.successorId, (incoming.get(link.successorId) ?? 0) + 1);
    outgoing.get(link.predecessorId)!.push(link.successorId);
  }

  const queue = ids.filter((id) => (incoming.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  const cyclic = new Set(ids.filter((id) => !order.includes(id)));
  return { order, cyclic };
}

/**
 * Works out float for every task and returns the critical path.
 *
 * Durations come from the task's own dates, so a task the planner has already
 * placed keeps its length; the passes decide where it *could* sit given its
 * dependencies, not how long it takes.
 */
export function computeCriticalPath(
  tasks: ScheduleTask[],
  links: ScheduleLink[],
): CriticalPathResult {
  const floats = new Map<string, TaskFloat>();
  if (tasks.length === 0) {
    return { floats, criticalPath: [], duration: 0, cyclicLinks: [] };
  }

  const origin = Math.min(...tasks.map((t) => toDate(t.startDate).setHours(0, 0, 0, 0)));
  const ids = tasks.map((t) => t.id);
  const known = new Set(ids);

  // Links pointing at tasks outside this set (another project, a deleted row)
  // are dropped rather than allowed to skew the passes.
  const usable = links.filter((l) => known.has(l.predecessorId) && known.has(l.successorId));

  const { order, cyclic } = topologicalOrder(ids, usable);
  const cyclicLinks = usable.filter(
    (l) => cyclic.has(l.predecessorId) || cyclic.has(l.successorId),
  );
  const acyclic = usable.filter(
    (l) => !cyclic.has(l.predecessorId) && !cyclic.has(l.successorId),
  );

  const duration = new Map<string, number>();
  const baseStart = new Map<string, number>();
  for (const task of tasks) {
    const start = dayOf(task.startDate, origin);
    const finish = dayOf(task.endDate, origin);
    baseStart.set(task.id, start);
    // Inclusive of both endpoints: a task starting and ending the same day
    // takes one day, not zero.
    duration.set(task.id, Math.max(0, finish - start) + 1);
  }

  const predecessorsOf = new Map<string, ScheduleLink[]>(ids.map((id) => [id, []]));
  const successorsOf = new Map<string, ScheduleLink[]>(ids.map((id) => [id, []]));
  for (const link of acyclic) {
    predecessorsOf.get(link.successorId)!.push(link);
    successorsOf.get(link.predecessorId)!.push(link);
  }

  // Tasks in a cycle keep their planned dates and are never called critical:
  // their float is undefined, and guessing at it would be worse than nothing.
  const scheduled = order.length > 0 ? order : ids.filter((id) => !cyclic.has(id));

  // ---- Forward pass: the earliest each task can happen -------------------
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();

  for (const id of scheduled) {
    const len = duration.get(id) ?? 1;
    let start = baseStart.get(id) ?? 0;

    for (const link of predecessorsOf.get(id) ?? []) {
      const lag = link.lagDays ?? 0;
      const predStart = earliestStart.get(link.predecessorId) ?? 0;
      const predFinish = earliestFinish.get(link.predecessorId) ?? 0;

      let constraint: number;
      switch (link.type ?? 'FINISH_TO_START') {
        case 'START_TO_START':
          constraint = predStart + lag;
          break;
        case 'FINISH_TO_FINISH':
          constraint = predFinish + lag - len + 1;
          break;
        case 'START_TO_FINISH':
          constraint = predStart + lag - len + 1;
          break;
        default:
          // Finish-to-start: the successor may begin the day after.
          constraint = predFinish + lag + 1;
      }
      start = Math.max(start, constraint);
    }

    earliestStart.set(id, start);
    earliestFinish.set(id, start + len - 1);
  }

  const projectFinish = Math.max(0, ...scheduled.map((id) => earliestFinish.get(id) ?? 0));

  // ---- Backward pass: the latest each task can happen --------------------
  const latestFinish = new Map<string, number>();
  const latestStart = new Map<string, number>();

  for (const id of [...scheduled].reverse()) {
    const len = duration.get(id) ?? 1;
    let finish = projectFinish;

    const successors = successorsOf.get(id) ?? [];
    if (successors.length > 0) {
      finish = Math.min(
        ...successors.map((link) => {
          const lag = link.lagDays ?? 0;
          const succStart = latestStart.get(link.successorId) ?? projectFinish;
          const succFinish = latestFinish.get(link.successorId) ?? projectFinish;

          switch (link.type ?? 'FINISH_TO_START') {
            case 'START_TO_START':
              return succStart - lag + len - 1;
            case 'FINISH_TO_FINISH':
              return succFinish - lag;
            case 'START_TO_FINISH':
              return succStart - lag + len - 1;
            default:
              return succStart - lag - 1;
          }
        }),
      );
    }

    latestFinish.set(id, finish);
    latestStart.set(id, finish - len + 1);
  }

  for (const id of ids) {
    if (cyclic.has(id)) {
      const start = baseStart.get(id) ?? 0;
      const len = duration.get(id) ?? 1;
      floats.set(id, {
        id,
        earliestStart: start,
        earliestFinish: start + len - 1,
        latestStart: start,
        latestFinish: start + len - 1,
        totalFloat: Number.NaN,
        isCritical: false,
      });
      continue;
    }

    const es = earliestStart.get(id) ?? 0;
    const ef = earliestFinish.get(id) ?? 0;
    const ls = latestStart.get(id) ?? 0;
    const lf = latestFinish.get(id) ?? 0;
    const totalFloat = ls - es;

    floats.set(id, {
      id,
      earliestStart: es,
      earliestFinish: ef,
      latestStart: ls,
      latestFinish: lf,
      totalFloat,
      isCritical: totalFloat <= 0,
    });
  }

  const criticalPath = scheduled
    .filter((id) => floats.get(id)?.isCritical)
    .sort((a, b) => (floats.get(a)!.earliestStart - floats.get(b)!.earliestStart));

  return {
    floats,
    criticalPath,
    duration: projectFinish + 1,
    cyclicLinks,
  };
}

/**
 * The date a day-offset corresponds to, given the same task set.
 *
 * Exposed so a chart can turn the passes' output back into dates without
 * re-deriving the origin and getting a different answer.
 */
export function scheduleOrigin(tasks: ScheduleTask[]): Date | null {
  if (tasks.length === 0) return null;
  return new Date(Math.min(...tasks.map((t) => toDate(t.startDate).setHours(0, 0, 0, 0))));
}
