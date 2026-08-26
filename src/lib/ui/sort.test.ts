import { describe, expect, it } from 'vitest';

import { sortMilestones, sortProjects, sortTasks } from './sort';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const ACTIVE = { name: 'Active', category: 'ACTIVE' as const };

/** A project with one milestone whose window runs start→due at `progress`. */
const project = (
  name: string,
  opts: { start?: number; end?: number; progress?: number; updatedAt?: number } = {},
) => ({
  id: name,
  name,
  status: ACTIVE,
  endDate: days(opts.end ?? 30),
  updatedAt: days(opts.updatedAt ?? 0),
  milestones: [
    {
      startDate: days(opts.start ?? -10),
      dueDate: days(opts.end ?? 30),
      tasks: [{ weight: 100, progress: opts.progress ?? 50 }],
    },
  ],
});

const names = (list: { name?: string | null }[]) => list.map((p) => p.name);

describe('sortProjects', () => {
  it('does not mutate the array it is given', () => {
    const input = [project('B'), project('A')];
    const before = names(input);
    sortProjects(input, 'name', NOW);
    expect(names(input)).toEqual(before);
  });

  it('orders by name', () => {
    const sorted = sortProjects([project('Charlie'), project('Alpha'), project('Bravo')], 'name', NOW);
    expect(names(sorted)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('orders by deadline, soonest first', () => {
    const sorted = sortProjects(
      [project('Late', { end: 60 }), project('Soon', { end: 5 }), project('Middle', { end: 30 })],
      'deadline',
      NOW,
    );
    expect(names(sorted)).toEqual(['Soon', 'Middle', 'Late']);
  });

  it('orders by least progress first', () => {
    const sorted = sortProjects(
      [
        project('Ahead', { progress: 90 }),
        project('Behind', { progress: 10 }),
        project('Middling', { progress: 50 }),
      ],
      'progress',
      NOW,
    );
    expect(names(sorted)).toEqual(['Behind', 'Middling', 'Ahead']);
  });

  it('puts the worst risk first and healthy projects last', () => {
    const overdue = project('Overdue', { start: -60, end: -5, progress: 40 });
    const behind = project('Behind', { start: -10, end: 10, progress: 5 });
    const healthy = project('Healthy', { start: -10, end: 90, progress: 60 });

    const sorted = sortProjects([healthy, behind, overdue], 'risk', NOW);
    expect(names(sorted)[0]).toBe('Overdue');
    // A project with nothing wrong sorts last: this view is for finding
    // trouble, and a healthy project is not an answer to that question.
    expect(names(sorted).at(-1)).toBe('Healthy');
  });

  it('orders by most recently updated', () => {
    const sorted = sortProjects(
      [
        project('Stale', { updatedAt: -30 }),
        project('Fresh', { updatedAt: -1 }),
        project('Older', { updatedAt: -10 }),
      ],
      'recent',
      NOW,
    );
    expect(names(sorted)).toEqual(['Fresh', 'Older', 'Stale']);
  });

  it('breaks ties on name, so the order is stable', () => {
    const a = { ...project('Zulu', { end: 10 }) };
    const b = { ...project('Alpha', { end: 10 }) };
    expect(names(sortProjects([a, b], 'deadline', NOW))).toEqual(['Alpha', 'Zulu']);
    expect(names(sortProjects([b, a], 'deadline', NOW))).toEqual(['Alpha', 'Zulu']);
  });
});

describe('sortMilestones', () => {
  const milestone = (title: string, start: number, due: number, progress: number) => ({
    id: title,
    title,
    startDate: days(start),
    dueDate: days(due),
    tasks: [{ weight: 100, progress }],
  });

  const titles = (list: { title?: string | null }[]) => list.map((m) => m.title);

  it('puts what needs attention first and complete work last', () => {
    const sorted = sortMilestones(
      [
        milestone('Complete', -60, -30, 100),
        milestone('OnTrack', -10, 10, 45),
        milestone('Overdue', -60, -2, 40),
        milestone('AtRisk', -10, 10, 5),
      ],
      'health',
      NOW,
    );
    expect(titles(sorted)).toEqual(['Overdue', 'AtRisk', 'OnTrack', 'Complete']);
  });

  it('orders by due date', () => {
    const sorted = sortMilestones(
      [milestone('Third', -10, 40, 50), milestone('First', -10, 2, 50), milestone('Second', -10, 20, 50)],
      'due',
      NOW,
    );
    expect(titles(sorted)).toEqual(['First', 'Second', 'Third']);
  });

  it('orders by least progress first', () => {
    const sorted = sortMilestones(
      [milestone('High', -10, 30, 80), milestone('Low', -10, 30, 10)],
      'progress',
      NOW,
    );
    expect(titles(sorted)).toEqual(['Low', 'High']);
  });
});

describe('sortTasks', () => {
  const task = (title: string, status: string, endDate: number, progress = 0) => ({
    title,
    status,
    endDate: days(endDate),
    progress,
  });

  const titles = (list: { title?: string | null }[]) => list.map((t) => t.title);

  it('puts work you can act on before work you cannot', () => {
    const sorted = sortTasks(
      [
        task('Done', 'DONE', 1),
        task('Todo', 'TODO', 1),
        task('Review', 'PENDING_REVIEW', 1),
        task('Doing', 'IN_PROGRESS', 1),
      ],
      'status',
    );
    expect(titles(sorted)).toEqual(['Doing', 'Review', 'Todo', 'Done']);
  });

  it('orders by due date, soonest first', () => {
    const sorted = sortTasks(
      [task('Later', 'TODO', 20), task('Sooner', 'TODO', 2), task('Overdue', 'TODO', -5)],
      'due',
    );
    expect(titles(sorted)).toEqual(['Overdue', 'Sooner', 'Later']);
  });

  it('does not mutate its input', () => {
    const input = [task('B', 'TODO', 5), task('A', 'TODO', 1)];
    const before = titles(input);
    sortTasks(input, 'due');
    expect(titles(input)).toEqual(before);
  });
});
