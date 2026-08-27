import { describe, expect, it } from 'vitest';

import { computeCriticalPath, type ScheduleLink, type ScheduleTask } from './critical-path';

const day = (n: number) => new Date(2026, 0, 1 + n);

/** A task occupying days [start, end] inclusive, relative to 1 Jan 2026. */
const task = (id: string, start: number, end: number): ScheduleTask => ({
  id,
  startDate: day(start),
  endDate: day(end),
});

const fs = (predecessorId: string, successorId: string, lagDays = 0): ScheduleLink => ({
  predecessorId,
  successorId,
  type: 'FINISH_TO_START',
  lagDays,
});

describe('computeCriticalPath', () => {
  it('handles an empty plan', () => {
    const result = computeCriticalPath([], []);
    expect(result.criticalPath).toEqual([]);
    expect(result.duration).toBe(0);
  });

  it('makes a single task critical', () => {
    const result = computeCriticalPath([task('a', 0, 4)], []);
    expect(result.criticalPath).toEqual(['a']);
    expect(result.floats.get('a')!.totalFloat).toBe(0);
    expect(result.duration).toBe(5);
  });

  it('counts an inclusive duration', () => {
    // A task that starts and finishes the same day takes one day. Offsets are
    // relative to the earliest task in the set, so a lone task starts at 0
    // however far into the calendar its dates sit.
    const result = computeCriticalPath([task('a', 3, 3)], []);
    const a = result.floats.get('a')!;
    expect(a.earliestStart).toBe(0);
    expect(a.earliestFinish - a.earliestStart).toBe(0);
    expect(result.duration).toBe(1);
  });

  it('measures offsets from the earliest task, not the calendar', () => {
    const result = computeCriticalPath([task('a', 10, 11), task('b', 12, 13)], []);
    expect(result.floats.get('a')!.earliestStart).toBe(0);
    expect(result.floats.get('b')!.earliestStart).toBe(2);
  });

  it('puts a finish-to-start successor after its predecessor', () => {
    const result = computeCriticalPath([task('a', 0, 2), task('b', 0, 1)], [fs('a', 'b')]);
    const a = result.floats.get('a')!;
    const b = result.floats.get('b')!;
    // b is pushed to the day after a finishes, whatever its own start said.
    expect(b.earliestStart).toBe(a.earliestFinish + 1);
  });

  it('honours lag', () => {
    const result = computeCriticalPath([task('a', 0, 2), task('b', 0, 1)], [fs('a', 'b', 3)]);
    const a = result.floats.get('a')!;
    const b = result.floats.get('b')!;
    expect(b.earliestStart).toBe(a.earliestFinish + 1 + 3);
  });

  it('finds the longest chain and gives the short one float', () => {
    // long:  a(3d) -> b(5d)      = 8 days
    // short: a(3d) -> c(1d)      = 4 days, so c has slack
    const tasks = [task('a', 0, 2), task('b', 0, 4), task('c', 0, 0)];
    const result = computeCriticalPath(tasks, [fs('a', 'b'), fs('a', 'c')]);

    expect(result.floats.get('a')!.isCritical).toBe(true);
    expect(result.floats.get('b')!.isCritical).toBe(true);
    expect(result.floats.get('c')!.isCritical).toBe(false);
    expect(result.floats.get('c')!.totalFloat).toBeGreaterThan(0);
    expect(result.criticalPath).toEqual(['a', 'b']);
  });

  it('returns the critical path in schedule order', () => {
    const tasks = [task('c', 0, 1), task('a', 0, 1), task('b', 0, 1)];
    const result = computeCriticalPath(tasks, [fs('a', 'b'), fs('b', 'c')]);
    expect(result.criticalPath).toEqual(['a', 'b', 'c']);
  });

  it('start-to-start lines two tasks up at the start', () => {
    const tasks = [task('a', 2, 6), task('b', 0, 1)];
    const result = computeCriticalPath(tasks, [
      { predecessorId: 'a', successorId: 'b', type: 'START_TO_START', lagDays: 0 },
    ]);
    expect(result.floats.get('b')!.earliestStart).toBe(result.floats.get('a')!.earliestStart);
  });

  it('finish-to-finish lines two tasks up at the end', () => {
    const tasks = [task('a', 0, 6), task('b', 0, 1)];
    const result = computeCriticalPath(tasks, [
      { predecessorId: 'a', successorId: 'b', type: 'FINISH_TO_FINISH', lagDays: 0 },
    ]);
    expect(result.floats.get('b')!.earliestFinish).toBe(result.floats.get('a')!.earliestFinish);
  });

  it('reports a cycle instead of hanging or throwing', () => {
    const tasks = [task('a', 0, 1), task('b', 0, 1)];
    const result = computeCriticalPath(tasks, [fs('a', 'b'), fs('b', 'a')]);

    expect(result.cyclicLinks.length).toBeGreaterThan(0);
    // Tasks in a cycle have undefined float and are never called critical.
    expect(result.floats.get('a')!.isCritical).toBe(false);
    expect(result.floats.get('b')!.isCritical).toBe(false);
  });

  it('ignores links pointing outside the task set', () => {
    const result = computeCriticalPath([task('a', 0, 2)], [fs('ghost', 'a'), fs('a', 'ghost')]);
    expect(result.cyclicLinks).toEqual([]);
    expect(result.floats.get('a')!.isCritical).toBe(true);
  });

  it('gives every task on a single chain zero float', () => {
    const tasks = [task('a', 0, 1), task('b', 0, 1), task('c', 0, 1)];
    const result = computeCriticalPath(tasks, [fs('a', 'b'), fs('b', 'c')]);
    for (const id of ['a', 'b', 'c']) {
      expect(result.floats.get(id)!.totalFloat).toBe(0);
    }
  });

  it('a delayed predecessor consumes its successor’s float', () => {
    //    a(2d) ─┐
    //           ├─> c(2d)
    // b(6d) ────┘
    // b is the long pole, so a gains float.
    const tasks = [task('a', 0, 1), task('b', 0, 5), task('c', 0, 1)];
    const result = computeCriticalPath(tasks, [fs('a', 'c'), fs('b', 'c')]);

    expect(result.floats.get('b')!.isCritical).toBe(true);
    expect(result.floats.get('a')!.totalFloat).toBe(4);
    expect(result.floats.get('c')!.isCritical).toBe(true);
  });
});
