import { describe, expect, it } from 'vitest';

import {
  AT_RISK_TOLERANCE,
  daysUntil,
  elapsedPercent,
  milestoneHealth,
  projectRisks,
  scheduleGap,
  summarizeMilestoneHealth,
  worstRisk,
} from './health';

/**
 * A fixed "now" so none of these become time bombs. Every date below is
 * relative to it.
 */
const NOW = new Date('2026-06-15T12:00:00.000Z');

const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

/** A milestone whose window runs from `start` to `due`, at `progress`. */
const milestone = (start: number, due: number, progress: number) => ({
  startDate: days(start),
  dueDate: days(due),
  tasks: [{ weight: 100, progress }],
});

describe('elapsedPercent', () => {
  it('is null when there is no window to measure', () => {
    expect(elapsedPercent({ dueDate: days(10) }, NOW)).toBeNull();
    expect(elapsedPercent({ startDate: days(-10) }, NOW)).toBeNull();
  });

  it('reads 0 before the window opens and 100 after it closes', () => {
    expect(elapsedPercent({ startDate: days(5), dueDate: days(15) }, NOW)).toBe(0);
    expect(elapsedPercent({ startDate: days(-20), dueDate: days(-10) }, NOW)).toBe(100);
  });

  it('is roughly half way through a symmetric window', () => {
    const value = elapsedPercent({ startDate: days(-10), dueDate: days(10) }, NOW);
    expect(value).toBeGreaterThan(45);
    expect(value).toBeLessThan(55);
  });
});

describe('scheduleGap', () => {
  it('is positive when progress trails elapsed time', () => {
    // Half the window gone, a tenth of the work done.
    const gap = scheduleGap(milestone(-10, 10, 10), NOW);
    expect(gap).not.toBeNull();
    expect(gap!).toBeGreaterThan(30);
  });

  it('is negative when the work is ahead of the clock', () => {
    const gap = scheduleGap(milestone(-10, 10, 90), NOW);
    expect(gap!).toBeLessThan(0);
  });
});

describe('milestoneHealth', () => {
  it('calls finished work complete even when it finished late', () => {
    expect(milestoneHealth(milestone(-30, -5, 100), NOW)).toBe('COMPLETE');
  });

  it('calls unfinished work past its due date overdue', () => {
    expect(milestoneHealth(milestone(-30, -1, 60), NOW)).toBe('OVERDUE');
  });

  it('does not call work due today overdue', () => {
    // The deadline runs to the end of the day, so a milestone due today has
    // hours left, not a breach.
    expect(milestoneHealth(milestone(-10, 0, 50), NOW)).not.toBe('OVERDUE');
  });

  it('flags work that trails the clock by more than the tolerance', () => {
    expect(milestoneHealth(milestone(-10, 10, 10), NOW)).toBe('AT_RISK');
  });

  it('leaves work inside the tolerance on track', () => {
    // ~50% elapsed, 45% done: five points behind, well inside tolerance.
    expect(milestoneHealth(milestone(-10, 10, 45), NOW)).toBe('ON_TRACK');
  });

  it('treats untouched work as not started while there is still time', () => {
    expect(milestoneHealth(milestone(-1, 30, 0), NOW)).toBe('NOT_STARTED');
  });

  it('treats untouched work as at risk once the window is half gone', () => {
    expect(milestoneHealth(milestone(-10, 5, 0), NOW)).toBe('AT_RISK');
  });

  it('does not guess when the window is unknown', () => {
    // No start date: nothing to compare against, so an unfinished milestone
    // that is not yet overdue stays on track rather than being invented as
    // at risk.
    expect(milestoneHealth({ dueDate: days(10), tasks: [{ weight: 100, progress: 5 }] }, NOW)).toBe(
      'ON_TRACK',
    );
  });

  it('uses endDate when the work has no dueDate', () => {
    expect(
      milestoneHealth({ startDate: days(-30), endDate: days(-1), tasks: [{ progress: 10 }] }, NOW),
    ).toBe('OVERDUE');
  });
});

describe('summarizeMilestoneHealth', () => {
  it('counts each milestone exactly once', () => {
    const counts = summarizeMilestoneHealth(
      [
        milestone(-30, -1, 50), // overdue
        milestone(-10, 10, 10), // at risk
        milestone(-10, 10, 45), // on track
        milestone(-1, 30, 0), // not started
        milestone(-30, -5, 100), // complete
      ],
      NOW,
    );

    expect(counts).toEqual({
      total: 5,
      overdue: 1,
      atRisk: 1,
      onTrack: 1,
      notStarted: 1,
      complete: 1,
    });
  });

  it('handles a project with no milestones', () => {
    expect(summarizeMilestoneHealth(null, NOW).total).toBe(0);
  });
});

describe('daysUntil', () => {
  it('is negative once the deadline has passed', () => {
    expect(daysUntil({ dueDate: days(-3) }, NOW)).toBeLessThan(0);
  });

  it('is null without a deadline', () => {
    expect(daysUntil({ startDate: days(-3) }, NOW)).toBeNull();
  });
});

describe('projectRisks', () => {
  const active = { name: 'Active', category: 'ACTIVE' as const };
  const closed = { name: 'Completed', category: 'CLOSED' as const };

  it('reports nothing for a healthy project', () => {
    const risks = projectRisks(
      {
        status: active,
        endDate: days(90),
        milestones: [milestone(-10, 10, 45)],
        blockers: [],
      },
      NOW,
    );
    expect(risks).toEqual([]);
  });

  it('flags an open project past its deadline as critical', () => {
    const risks = projectRisks(
      { status: active, endDate: days(-4), milestones: [milestone(-30, -4, 50)] },
      NOW,
    );
    expect(risks[0].severity).toBe('critical');
    expect(risks.some((r) => r.id === 'project-overdue')).toBe(true);
  });

  it('does not call a finished project overdue', () => {
    const risks = projectRisks(
      { status: closed, endDate: days(-40), milestones: [milestone(-60, -40, 100)] },
      NOW,
    );
    expect(risks.some((r) => r.id === 'project-overdue')).toBe(false);
  });

  it('separates serious open issues from ordinary ones', () => {
    const serious = projectRisks(
      {
        status: active,
        endDate: days(60),
        milestones: [],
        blockers: [{ status: 'OPEN', severity: 'CRITICAL', ownerId: 'u1' }],
      },
      NOW,
    );
    expect(serious.some((r) => r.id === 'blockers-serious')).toBe(true);
    expect(serious.some((r) => r.id === 'blockers-open')).toBe(false);

    const ordinary = projectRisks(
      {
        status: active,
        endDate: days(60),
        milestones: [],
        blockers: [{ status: 'OPEN', severity: 'LOW', ownerId: 'u1' }],
      },
      NOW,
    );
    expect(ordinary.some((r) => r.id === 'blockers-open')).toBe(true);
  });

  it('ignores issues that are already resolved', () => {
    const risks = projectRisks(
      {
        status: active,
        endDate: days(60),
        milestones: [milestone(-10, 10, 45)],
        blockers: [{ status: 'RESOLVED', severity: 'CRITICAL' }],
      },
      NOW,
    );
    expect(risks.some((r) => r.id.startsWith('blockers'))).toBe(false);
  });

  it('flags open issues nobody owns', () => {
    const risks = projectRisks(
      {
        status: active,
        endDate: days(60),
        milestones: [milestone(-10, 10, 45)],
        blockers: [{ status: 'OPEN', severity: 'MEDIUM', ownerId: null }],
      },
      NOW,
    );
    expect(risks.some((r) => r.id === 'blockers-unowned')).toBe(true);
  });

  it('states a deadline that has already moved', () => {
    const risks = projectRisks(
      {
        status: active,
        endDate: days(30),
        baselineEndDate: days(0),
        milestones: [milestone(-10, 10, 45)],
      },
      NOW,
    );
    const slip = risks.find((r) => r.id === 'baseline-slip');
    expect(slip).toBeDefined();
    expect(slip!.label).toContain('30 day');
  });

  it('says nothing about a baseline that never moved', () => {
    const risks = projectRisks(
      {
        status: active,
        endDate: days(30),
        baselineEndDate: days(30),
        milestones: [milestone(-10, 10, 45)],
      },
      NOW,
    );
    expect(risks.some((r) => r.id === 'baseline-slip')).toBe(false);
  });

  it('puts the worst problem first', () => {
    const risks = projectRisks(
      {
        status: active,
        endDate: days(-2),
        baselineEndDate: days(-30),
        milestones: [milestone(-30, -2, 40)],
        blockers: [{ status: 'OPEN', severity: 'LOW' }],
      },
      NOW,
    );
    expect(risks[0].severity).toBe('critical');
    expect(risks[risks.length - 1].severity).toBe('info');
  });

  it('quotes the tolerance it actually used', () => {
    const risks = projectRisks(
      { status: active, endDate: days(90), milestones: [milestone(-10, 10, 10)] },
      NOW,
    );
    const behind = risks.find((r) => r.id === 'milestones-at-risk');
    expect(behind!.detail).toContain(String(AT_RISK_TOLERANCE));
  });
});

describe('worstRisk', () => {
  it('is null when nothing is wrong', () => {
    expect(
      worstRisk(
        {
          status: { category: 'ACTIVE' },
          endDate: days(90),
          milestones: [milestone(-10, 10, 45)],
        },
        NOW,
      ),
    ).toBeNull();
  });

  it('is the critical one when there is a mix', () => {
    const risk = worstRisk(
      {
        status: { category: 'ACTIVE' },
        endDate: days(-1),
        milestones: [milestone(-30, -1, 20)],
      },
      NOW,
    );
    expect(risk!.severity).toBe('critical');
  });
});
