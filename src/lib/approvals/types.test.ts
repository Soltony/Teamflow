import { describe, expect, it } from 'vitest';

import {
  ageInDays,
  daysToBreach,
  slaState,
  sortApprovals,
  summarizeInbox,
  type ApprovalItem,
} from './types';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const SLA = { slaDays: 3, warningDays: 2 };

const item = (over: Partial<ApprovalItem> & { id: string }): ApprovalItem => ({
  kind: 'task',
  entityId: over.id,
  title: over.id,
  projectId: 'p1',
  projectName: 'Project One',
  requestedByName: 'Someone',
  submittedAt: daysAgo(0),
  rationale: null,
  facts: [],
  approveEffect: '',
  rejectEffect: '',
  href: null,
  canDecide: true,
  amount: null,
  currency: null,
  ...over,
});

describe('ageInDays', () => {
  it('counts whole days waited', () => {
    expect(ageInDays(daysAgo(0), NOW)).toBe(0);
    expect(ageInDays(daysAgo(5), NOW)).toBe(5);
  });

  it('never goes negative for a future timestamp', () => {
    const future = new Date(NOW.getTime() + 86_400_000).toISOString();
    expect(ageInDays(future, NOW)).toBe(0);
  });

  it('treats an unparseable date as brand new rather than throwing', () => {
    expect(ageInDays('not a date', NOW)).toBe(0);
  });
});

describe('slaState', () => {
  it('is on time inside the warning window', () => {
    expect(slaState(daysAgo(0), SLA, NOW)).toBe('ON_TIME');
    expect(slaState(daysAgo(1), SLA, NOW)).toBe('ON_TIME');
  });

  it('warns once the warning line is reached', () => {
    expect(slaState(daysAgo(2), SLA, NOW)).toBe('DUE_SOON');
  });

  it('breaches on the SLA day itself, not the day after', () => {
    expect(slaState(daysAgo(3), SLA, NOW)).toBe('BREACHED');
    expect(slaState(daysAgo(9), SLA, NOW)).toBe('BREACHED');
  });

  it('cannot be configured so the warning fires after the breach', () => {
    // Warning longer than the SLA is a misconfiguration; it must not produce
    // an item that breaches without ever having warned.
    const silly = { slaDays: 2, warningDays: 10 };
    expect(slaState(daysAgo(1), silly, NOW)).toBe('ON_TIME');
    expect(slaState(daysAgo(2), silly, NOW)).toBe('BREACHED');
  });
});

describe('daysToBreach', () => {
  it('counts down and then goes negative', () => {
    expect(daysToBreach(daysAgo(0), SLA, NOW)).toBe(3);
    expect(daysToBreach(daysAgo(3), SLA, NOW)).toBe(0);
    expect(daysToBreach(daysAgo(5), SLA, NOW)).toBe(-2);
  });
});

describe('sortApprovals', () => {
  it('does not mutate its input', () => {
    const input = [item({ id: 'b' }), item({ id: 'a' })];
    const before = input.map((i) => i.id);
    sortApprovals(input, 'project', SLA, NOW);
    expect(input.map((i) => i.id)).toEqual(before);
  });

  it('puts breached items first when sorting by SLA', () => {
    const sorted = sortApprovals(
      [
        item({ id: 'fresh', submittedAt: daysAgo(0) }),
        item({ id: 'breached', submittedAt: daysAgo(6) }),
        item({ id: 'soon', submittedAt: daysAgo(2) }),
      ],
      'sla',
      SLA,
      NOW,
    );
    expect(sorted.map((i) => i.id)).toEqual(['breached', 'soon', 'fresh']);
  });

  it('orders by age', () => {
    const sorted = sortApprovals(
      [
        item({ id: 'new', submittedAt: daysAgo(1) }),
        item({ id: 'old', submittedAt: daysAgo(9) }),
      ],
      'oldest',
      SLA,
      NOW,
    );
    expect(sorted[0].id).toBe('old');
  });

  it('sorts items without an amount last, not as zero', () => {
    const sorted = sortApprovals(
      [
        item({ id: 'task', amount: null }),
        item({ id: 'small', kind: 'payment', amount: 10 }),
        item({ id: 'big', kind: 'payment', amount: 5000 }),
      ],
      'amount',
      SLA,
      NOW,
    );
    expect(sorted.map((i) => i.id)).toEqual(['big', 'small', 'task']);
  });
});

describe('summarizeInbox', () => {
  it('counts kinds and SLA states without double counting', () => {
    const summary = summarizeInbox(
      [
        item({ id: '1', kind: 'task', submittedAt: daysAgo(6) }),
        item({ id: '2', kind: 'timeline', submittedAt: daysAgo(2) }),
        item({ id: '3', kind: 'payment', submittedAt: daysAgo(0) }),
        item({ id: '4', kind: 'payment', submittedAt: daysAgo(4) }),
      ],
      SLA,
      NOW,
    );

    expect(summary.total).toBe(4);
    expect(summary.byKind).toEqual({ task: 1, timeline: 1, payment: 2 });
    expect(summary.breached).toBe(2);
    expect(summary.dueSoon).toBe(1);
    expect(summary.oldestDays).toBe(6);
  });

  it('is all zeroes for an empty inbox', () => {
    const summary = summarizeInbox([], SLA, NOW);
    expect(summary.total).toBe(0);
    expect(summary.breached).toBe(0);
    expect(summary.oldestDays).toBe(0);
  });
});
