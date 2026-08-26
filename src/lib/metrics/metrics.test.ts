import { describe, expect, it } from 'vitest';

import { checkWeights, displayProgress, milestoneProgress, projectProgress } from './progress';
import {
  actualCompletionDate,
  baselineSlipDays,
  daysRemaining,
  deadlineFor,
  isLate,
  isOnTime,
  isOverdue,
  scheduleVarianceDays,
  summarizeSchedule,
} from './schedule';
import { isArchivedStatus, isClosedStatus, isLiveStatus, statusCategory } from './status';

const task = (weight: number, progress: number) => ({ weight, progress });

describe('milestoneProgress', () => {
  it('is 100 when every task is done, even if the weights do not add to 100', () => {
    // The defect that made a fully delivered milestone report 70%.
    const milestone = { weight: 100, tasks: [task(40, 100), task(30, 100)] };
    expect(milestoneProgress(milestone)).toBe(100);
  });

  it('weights tasks by their share', () => {
    const milestone = { weight: 100, tasks: [task(75, 100), task(25, 0)] };
    expect(milestoneProgress(milestone)).toBe(75);
  });

  it('averages equally when no task declares a weight', () => {
    const milestone = { weight: 100, tasks: [task(0, 100), task(0, 0)] };
    expect(milestoneProgress(milestone)).toBe(50);
  });

  it('gives unweighted tasks the leftover weight rather than dropping them', () => {
    // 60 declared + one unweighted task, which therefore carries 40.
    const milestone = { weight: 100, tasks: [task(60, 100), task(0, 0)] };
    expect(milestoneProgress(milestone)).toBe(60);
  });

  it('is 0 for a milestone with no tasks', () => {
    expect(milestoneProgress({ weight: 50, tasks: [] })).toBe(0);
    expect(milestoneProgress({ weight: 50, tasks: null })).toBe(0);
    expect(milestoneProgress(null)).toBe(0);
  });

  it('never exceeds 100 even if a task carries a nonsense progress value', () => {
    expect(milestoneProgress({ weight: 100, tasks: [task(100, 500)] })).toBe(100);
  });
});

describe('projectProgress', () => {
  it('reaches 100 when all milestones are complete', () => {
    const project = {
      milestones: [
        { weight: 30, tasks: [task(100, 100)] },
        { weight: 70, tasks: [task(100, 100)] },
      ],
    };
    expect(projectProgress(project)).toBe(100);
  });

  it('normalises when milestone weights do not total 100', () => {
    // Weights of 30 + 30 used to yield 60%, not 100%.
    const project = {
      milestones: [
        { weight: 30, tasks: [task(100, 100)] },
        { weight: 30, tasks: [task(100, 100)] },
      ],
    };
    expect(projectProgress(project)).toBe(100);
  });

  it('counts a zero-weight milestone instead of silently discarding it', () => {
    // This is the "General Tasks" case: project-level tasks contributed
    // nothing whenever the project also had weighted milestones.
    const project = {
      milestones: [
        { weight: 50, tasks: [task(100, 100)] },
        { weight: 0, tasks: [task(100, 0)] },
      ],
    };
    expect(projectProgress(project)).toBe(50);
  });

  it('treats an empty milestone as unstarted weight, not as absent', () => {
    const project = {
      milestones: [
        { weight: 50, tasks: [task(100, 100)] },
        { weight: 50, tasks: [] },
      ],
    };
    expect(projectProgress(project)).toBe(50);
  });

  it('is 0 for a project with no milestones', () => {
    expect(projectProgress({ milestones: [] })).toBe(0);
    expect(projectProgress(null)).toBe(0);
  });
});

describe('displayProgress', () => {
  it('rounds consistently and stays inside 0-100', () => {
    expect(displayProgress(66.6)).toBe(67);
    expect(displayProgress(-5)).toBe(0);
    expect(displayProgress(140)).toBe(100);
  });
});

describe('checkWeights', () => {
  it('accepts weights that total 100', () => {
    expect(checkWeights([40, 60])).toMatchObject({ isComplete: true, remaining: 0 });
  });

  it('reports what is left when they do not', () => {
    expect(checkWeights([40, 30])).toMatchObject({ total: 70, isComplete: false, remaining: 30 });
  });

  it('reports an overshoot as negative remaining', () => {
    expect(checkWeights([70, 50]).remaining).toBe(-20);
  });

  it('tolerates floating point entry', () => {
    expect(checkWeights([33.33, 33.33, 33.34]).isComplete).toBe(true);
  });

  it('treats missing weights as zero', () => {
    expect(checkWeights([50, null, undefined]).total).toBe(50);
  });
});

// ---------------------------------------------------------------------------

const CLOSED = { name: 'Completed' };
const ACTIVE = { name: 'Active' };

const project = (over: Record<string, unknown> = {}) => ({
  endDate: '2026-06-30',
  status: CLOSED,
  milestones: [{ tasks: [{ endDate: '2026-06-01', completedAt: '2026-06-01' }] }],
  ...over,
});

describe('statusCategory', () => {
  it('prefers the stored category over the name, so a rename is harmless', () => {
    // The whole point of the category column: an administrator renaming
    // "Completed" to "Delivered" must not break completion reporting.
    expect(statusCategory({ name: 'Delivered', category: 'CLOSED' })).toBe('CLOSED');
    expect(statusCategory({ name: 'Completed', category: 'ACTIVE' })).toBe('ACTIVE');
  });

  it('falls back to the name when no category is present', () => {
    expect(statusCategory({ name: 'Completed' })).toBe('CLOSED');
    expect(statusCategory({ name: 'Parked', category: null })).toBe('ON_HOLD');
  });

  it('ignores a category value it does not recognise', () => {
    expect(statusCategory({ name: 'Completed', category: 'NONSENSE' })).toBe('CLOSED');
  });

  it('classifies the statuses this system ships with', () => {
    expect(statusCategory('Active')).toBe('ACTIVE');
    expect(statusCategory('Pending')).toBe('ACTIVE');
    expect(statusCategory('Parked')).toBe('ON_HOLD');
    expect(statusCategory('On Handover')).toBe('HANDOVER');
    expect(statusCategory('Completed')).toBe('CLOSED');
  });

  it('ignores case and surrounding space', () => {
    expect(statusCategory('  completed ')).toBe('CLOSED');
  });

  it('does not guess at an unrecognised status', () => {
    expect(statusCategory('Bespoke Status')).toBe('UNKNOWN');
    expect(statusCategory(null)).toBe('UNKNOWN');
  });

  it('separates live, archived and closed', () => {
    expect(isLiveStatus('Active')).toBe(true);
    expect(isLiveStatus('Completed')).toBe(false);
    expect(isArchivedStatus('On Handover')).toBe(true);
    expect(isArchivedStatus('Active')).toBe(false);
    expect(isClosedStatus('Completed')).toBe(true);
    expect(isClosedStatus('On Handover')).toBe(false);
  });
});

describe('actualCompletionDate', () => {
  it('is the latest task completion', () => {
    const p = project({
      milestones: [
        { tasks: [{ endDate: '2026-01-01', completedAt: '2026-05-01' }] },
        { tasks: [{ endDate: '2026-01-01', completedAt: '2026-06-10' }] },
      ],
    });
    expect(actualCompletionDate(p)?.toISOString().slice(0, 10)).toBe('2026-06-10');
  });

  it('is null while any task is outstanding', () => {
    // The bug: unfinished tasks used to be mapped to the epoch and ignored.
    const p = project({
      milestones: [
        { tasks: [{ endDate: '2026-01-01', completedAt: '2026-05-01' }, { endDate: '2026-02-01', completedAt: null }] },
      ],
    });
    expect(actualCompletionDate(p)).toBeNull();
  });

  it('is null when there are no tasks', () => {
    expect(actualCompletionDate(project({ milestones: [] }))).toBeNull();
  });
});

describe('isOnTime', () => {
  it('is true when the work finished on or before the deadline', () => {
    expect(isOnTime(project())).toBe(true);
  });

  it('is false when the work finished after the deadline', () => {
    const p = project({
      milestones: [{ tasks: [{ endDate: '2026-06-01', completedAt: '2026-07-15' }] }],
    });
    expect(isOnTime(p)).toBe(false);
    expect(isLate(p)).toBe(true);
  });

  it('is false for a closed project that still has unfinished tasks', () => {
    const p = project({
      milestones: [{ tasks: [{ endDate: '2026-06-01', completedAt: null }] }],
    });
    expect(isOnTime(p)).toBe(false);
  });

  it('is false for a project that is not closed, however early it looks', () => {
    expect(isOnTime(project({ status: ACTIVE }))).toBe(false);
  });

  it('treats a closed project with no tasks as on time', () => {
    expect(isOnTime(project({ milestones: [] }))).toBe(true);
  });

  it('judges against the baseline, not the extended date', () => {
    // Finished 15 July, originally due 30 June, extended to 31 August.
    const p = project({
      endDate: '2026-08-31',
      baselineEndDate: '2026-06-30',
      milestones: [{ tasks: [{ endDate: '2026-06-01', completedAt: '2026-07-15' }] }],
    });
    expect(deadlineFor(p).toISOString().slice(0, 10)).toBe('2026-06-30');
    expect(isOnTime(p)).toBe(false);
  });

  it('counts completion on the deadline date itself as on time', () => {
    const p = project({
      endDate: '2026-06-30',
      milestones: [{ tasks: [{ endDate: '2026-06-30', completedAt: '2026-06-30T18:00:00' }] }],
    });
    expect(isOnTime(p)).toBe(true);
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-07-15T09:00:00Z');

  it('is true for a live project past its deadline', () => {
    expect(isOverdue(project({ status: ACTIVE, endDate: '2026-06-30' }), now)).toBe(true);
  });

  it('is false on the deadline day itself', () => {
    expect(isOverdue(project({ status: ACTIVE, endDate: '2026-07-15' }), now)).toBe(false);
  });

  it('is false for a closed project, however late it was', () => {
    expect(isOverdue(project({ status: CLOSED, endDate: '2026-01-01' }), now)).toBe(false);
  });

  it('includes on-hold projects, which are still the EPMO problem', () => {
    expect(isOverdue(project({ status: { name: 'Parked' }, endDate: '2026-06-30' }), now)).toBe(true);
  });
});

describe('variance', () => {
  it('reports days late against the baseline', () => {
    const p = project({
      endDate: '2026-08-31',
      baselineEndDate: '2026-06-30',
      milestones: [{ tasks: [{ endDate: '2026-06-01', completedAt: '2026-07-10' }] }],
    });
    expect(scheduleVarianceDays(p)).toBe(10);
  });

  it('reports early delivery as negative', () => {
    const p = project({
      endDate: '2026-06-30',
      milestones: [{ tasks: [{ endDate: '2026-06-01', completedAt: '2026-06-20' }] }],
    });
    expect(scheduleVarianceDays(p)).toBe(-10);
  });

  it('is null while the project is unfinished', () => {
    expect(scheduleVarianceDays(project({ status: ACTIVE }))).toBeNull();
  });

  it('measures how far the plan has slipped from the baseline', () => {
    expect(baselineSlipDays(project({ endDate: '2026-08-31', baselineEndDate: '2026-06-30' }))).toBe(62);
    expect(baselineSlipDays(project({ endDate: '2026-06-30', baselineEndDate: '2026-06-30' }))).toBe(0);
  });

  it('reports no slip figure when no baseline was captured', () => {
    expect(baselineSlipDays(project({ baselineEndDate: null }))).toBeNull();
  });

  it('counts days remaining from the current plan', () => {
    const now = new Date('2026-06-20T12:00:00Z');
    expect(daysRemaining(project({ endDate: '2026-06-30' }), now)).toBeGreaterThan(0);
    expect(daysRemaining(project({ endDate: '2026-06-01' }), now)).toBeLessThan(0);
  });
});

describe('summarizeSchedule', () => {
  it('gives one set of counts for every screen to share', () => {
    const now = new Date('2026-07-15T00:00:00Z');
    const summary = summarizeSchedule(
      [
        project(), // closed, on time
        project({ milestones: [{ tasks: [{ endDate: '2026-06-01', completedAt: '2026-07-20' }] }] }), // closed, late
        project({ status: ACTIVE, endDate: '2026-06-01' }), // live, overdue
        project({ status: ACTIVE, endDate: '2026-12-01' }), // live, fine
      ],
      now,
    );

    expect(summary).toMatchObject({ total: 4, closed: 2, onTime: 1, late: 1, overdue: 1 });
    expect(summary.onTimeRate).toBe(50);
  });

  it('reports a rate of 0 rather than dividing by zero', () => {
    expect(summarizeSchedule([project({ status: ACTIVE })]).onTimeRate).toBe(0);
  });

  it('always splits closed projects into exactly on-time plus late', () => {
    const projects = [project(), project({ status: ACTIVE }), project({ milestones: [{ tasks: [{ endDate: '2026-01-01', completedAt: null }] }] })];
    const s = summarizeSchedule(projects);
    expect(s.onTime + s.late).toBe(s.closed);
  });
});
