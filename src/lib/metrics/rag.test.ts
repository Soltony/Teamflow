import { describe, expect, it } from 'vitest';

import {
  assessRag,
  budgetUsedPercent,
  budgetVariancePercent,
  committedSpend,
  elapsedSchedulePercent,
  scheduleVariancePercent,
  summarizeRag,
} from './rag';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const ACTIVE = { name: 'Active', category: 'ACTIVE' as const };
const CLOSED = { name: 'Completed', category: 'CLOSED' as const };

/** A project whose window is [start, end] with a single milestone at `progress`. */
const project = (opts: {
  start?: number;
  end?: number;
  progress?: number;
  status?: typeof ACTIVE | typeof CLOSED;
  totalCost?: number;
  approved?: number[];
  pending?: number[];
}) => ({
  startDate: days(opts.start ?? -50),
  endDate: days(opts.end ?? 50),
  status: opts.status ?? ACTIVE,
  totalCost: opts.totalCost,
  milestones: [{ weight: 100, tasks: [{ weight: 100, progress: opts.progress ?? 50 }] }],
  payments: [
    ...(opts.approved ?? []).map((amount) => ({ amount, status: 'APPROVED' })),
    ...(opts.pending ?? []).map((amount) => ({ amount, status: 'PENDING' })),
  ],
});

describe('elapsedSchedulePercent', () => {
  it('is null without a window', () => {
    expect(elapsedSchedulePercent({ startDate: days(-1) }, NOW)).toBeNull();
  });

  it('is about half way through a symmetric window', () => {
    const value = elapsedSchedulePercent(project({ start: -50, end: 50 }), NOW)!;
    expect(value).toBeGreaterThan(45);
    expect(value).toBeLessThan(55);
  });

  it('clamps outside the window', () => {
    expect(elapsedSchedulePercent(project({ start: 10, end: 20 }), NOW)).toBe(0);
    expect(elapsedSchedulePercent(project({ start: -40, end: -20 }), NOW)).toBe(100);
  });
});

describe('scheduleVariancePercent', () => {
  it('is negative when delivery trails the calendar', () => {
    const value = scheduleVariancePercent(project({ start: -50, end: 50, progress: 20 }), NOW)!;
    expect(value).toBeLessThan(-25);
  });

  it('is positive when delivery is ahead', () => {
    const value = scheduleVariancePercent(project({ start: -50, end: 50, progress: 80 }), NOW)!;
    expect(value).toBeGreaterThan(25);
  });
});

describe('budget', () => {
  it('counts only approved payments as committed', () => {
    const p = project({ totalCost: 1000, approved: [200, 300], pending: [400] });
    expect(committedSpend(p)).toBe(500);
    expect(budgetUsedPercent(p)).toBe(50);
  });

  it('has no budget figures without a budget', () => {
    expect(budgetUsedPercent(project({ approved: [100] }))).toBeNull();
    expect(budgetVariancePercent(project({ approved: [100] }), NOW)).toBeNull();
  });

  it('is negative when spend has outrun delivery', () => {
    // Half delivered, four fifths of the money committed.
    const value = budgetVariancePercent(
      project({ progress: 50, totalCost: 1000, approved: [800] }),
      NOW,
    )!;
    expect(value).toBeCloseTo(-30, 5);
  });

  it('is positive when delivery has outrun spend', () => {
    const value = budgetVariancePercent(
      project({ progress: 80, totalCost: 1000, approved: [300] }),
      NOW,
    )!;
    expect(value).toBeCloseTo(50, 5);
  });

  it('handles decimal amounts arriving as strings', () => {
    const p = { totalCost: '1000.00', payments: [{ amount: '250.50', status: 'APPROVED' }] };
    expect(committedSpend(p)).toBeCloseTo(250.5, 5);
  });
});

describe('assessRag', () => {
  it('is green when schedule and budget are both healthy', () => {
    const result = assessRag(
      project({ start: -50, end: 50, progress: 52, totalCost: 1000, approved: [500] }),
      NOW,
    );
    expect(result.rag).toBe('GREEN');
    expect(result.reasons).toEqual([]);
  });

  it('is complete for a closed project rather than green', () => {
    // "Green" would tell the reader work is going well right now, and none is.
    const result = assessRag(project({ status: CLOSED, progress: 100 }), NOW);
    expect(result.rag).toBe('COMPLETE');
  });

  it('is amber once schedule slips past the amber threshold', () => {
    const result = assessRag(project({ start: -50, end: 50, progress: 38 }), NOW);
    expect(result.rag).toBe('AMBER');
    expect(result.reasons.join(' ')).toContain('behind schedule');
  });

  it('is red once schedule slips past the red threshold', () => {
    const result = assessRag(project({ start: -50, end: 50, progress: 20 }), NOW);
    expect(result.rag).toBe('RED');
  });

  it('is red for an open project past its deadline, whatever the variances', () => {
    const result = assessRag(project({ start: -100, end: -5, progress: 100 }), NOW);
    expect(result.rag).toBe('RED');
    expect(result.reasons.join(' ')).toContain('past its deadline');
  });

  it('is red on budget alone', () => {
    const result = assessRag(
      project({ start: -50, end: 50, progress: 50, totalCost: 1000, approved: [900] }),
      NOW,
    );
    expect(result.rag).toBe('RED');
    expect(result.reasons.join(' ')).toContain('budget');
  });

  it('takes the worst of the two, never the average', () => {
    // On schedule, badly overspent: still red.
    const result = assessRag(
      project({ start: -50, end: 50, progress: 51, totalCost: 1000, approved: [950] }),
      NOW,
    );
    expect(result.rag).toBe('RED');
  });

  it('never reports a colour without a reason', () => {
    const result = assessRag(project({ start: -50, end: 50, progress: 20 }), NOW);
    expect(result.rag).not.toBe('GREEN');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('survives a project with no dates or budget', () => {
    const result = assessRag({ status: ACTIVE, milestones: [] }, NOW);
    expect(result.rag).toBe('GREEN');
    expect(result.scheduleVariance).toBeNull();
    expect(result.budgetVariance).toBeNull();
  });
});

describe('summarizeRag', () => {
  it('counts each project exactly once', () => {
    const summary = summarizeRag(
      [
        project({ start: -50, end: 50, progress: 52 }), // green
        project({ start: -50, end: 50, progress: 38 }), // amber
        project({ start: -50, end: 50, progress: 20 }), // red
        project({ status: CLOSED, progress: 100 }), // complete
      ],
      NOW,
    );
    expect(summary.total).toBe(4);
    expect(summary.green + summary.amber + summary.red + summary.complete).toBe(4);
    expect(summary.red).toBe(1);
    expect(summary.amber).toBe(1);
    expect(summary.complete).toBe(1);
  });

  it('averages only the projects that have a variance', () => {
    const summary = summarizeRag(
      [project({ start: -50, end: 50, progress: 50 }), { status: ACTIVE, milestones: [] }],
      NOW,
    );
    expect(summary.averageScheduleVariance).not.toBeNull();
  });

  it('has no averages for an empty portfolio', () => {
    const summary = summarizeRag([], NOW);
    expect(summary.total).toBe(0);
    expect(summary.averageScheduleVariance).toBeNull();
  });
});
