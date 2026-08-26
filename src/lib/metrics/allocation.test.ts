import { describe, expect, it } from 'vitest';

import {
  isActiveOn,
  remainingCapacity,
  summarizeAllocation,
  totalAllocation,
  type AssignmentLike,
} from './allocation';

const DAY = new Date('2026-06-15T12:00:00Z');

const assignment = (over: Partial<AssignmentLike> = {}): AssignmentLike => ({
  userId: 'u1',
  projectId: 'p1',
  allocationPct: 100,
  ...over,
});

describe('isActiveOn', () => {
  it('treats an assignment with no dates as running', () => {
    // Open-ended is the common case; treating it as inactive would hide most
    // of the register.
    expect(isActiveOn(assignment(), DAY)).toBe(true);
  });

  it('is active on its first and last day', () => {
    expect(isActiveOn(assignment({ startDate: '2026-06-15', endDate: '2026-06-15' }), DAY)).toBe(true);
  });

  it('is not active before it starts or after it ends', () => {
    expect(isActiveOn(assignment({ startDate: '2026-06-16' }), DAY)).toBe(false);
    expect(isActiveOn(assignment({ endDate: '2026-06-14' }), DAY)).toBe(false);
  });

  it('treats a missing bound as open-ended in that direction', () => {
    expect(isActiveOn(assignment({ startDate: '2026-01-01' }), DAY)).toBe(true);
    expect(isActiveOn(assignment({ endDate: '2026-12-31' }), DAY)).toBe(true);
  });
});

describe('totalAllocation', () => {
  it('adds up what one person is committed to', () => {
    const rows = [
      assignment({ projectId: 'p1', allocationPct: 60 }),
      assignment({ projectId: 'p2', allocationPct: 30 }),
      assignment({ userId: 'u2', projectId: 'p3', allocationPct: 100 }),
    ];
    expect(totalAllocation(rows, 'u1', DAY)).toBe(90);
    expect(totalAllocation(rows, 'u2', DAY)).toBe(100);
  });

  it('ignores assignments that have ended', () => {
    const rows = [
      assignment({ projectId: 'p1', allocationPct: 100, endDate: '2026-01-31' }),
      assignment({ projectId: 'p2', allocationPct: 50 }),
    ];
    expect(totalAllocation(rows, 'u1', DAY)).toBe(50);
  });

  it('is zero for somebody with nothing on', () => {
    expect(totalAllocation([], 'u1', DAY)).toBe(0);
  });
});

describe('summarizeAllocation', () => {
  it('shows the person on four projects at full time as over-allocated', () => {
    // The case this module exists for. Team membership alone would show four
    // memberships and nothing wrong.
    const rows = ['p1', 'p2', 'p3', 'p4'].map((projectId) =>
      assignment({ projectId, allocationPct: 100 }),
    );
    const [row] = summarizeAllocation(rows, DAY);
    expect(row.totalPct).toBe(400);
    expect(row.projectCount).toBe(4);
    expect(row.isOverAllocated).toBe(true);
    expect(row.hasSpareCapacity).toBe(false);
  });

  it('does not call exactly full over-allocated', () => {
    const [row] = summarizeAllocation([assignment({ allocationPct: 100 })], DAY);
    expect(row.isOverAllocated).toBe(false);
    expect(row.hasSpareCapacity).toBe(false);
  });

  it('reports spare capacity below a full week', () => {
    const [row] = summarizeAllocation([assignment({ allocationPct: 40 })], DAY);
    expect(row.hasSpareCapacity).toBe(true);
    expect(row.totalPct).toBe(40);
  });

  it('counts two roles on the same project as one project', () => {
    // Somebody can be both team lead and a member. That is two assignment
    // rows and still one project.
    const rows = [
      assignment({ projectId: 'p1', allocationPct: 50 }),
      { userId: 'u1', projectId: 'p1', allocationPct: 30 },
    ];
    const [row] = summarizeAllocation(rows, DAY);
    expect(row.projectCount).toBe(1);
    expect(row.totalPct).toBe(80);
  });

  it('puts the most over-committed person first', () => {
    const rows = [
      { userId: 'a', projectId: 'p1', allocationPct: 50 },
      { userId: 'b', projectId: 'p1', allocationPct: 150 },
      { userId: 'c', projectId: 'p1', allocationPct: 100 },
    ];
    expect(summarizeAllocation(rows, DAY).map((r) => r.userId)).toEqual(['b', 'c', 'a']);
  });

  it('omits people with no active assignment rather than inventing a zero row', () => {
    const rows = [assignment({ endDate: '2020-01-01' })];
    expect(summarizeAllocation(rows, DAY)).toEqual([]);
  });
});

describe('remainingCapacity', () => {
  it('is what is left of the week', () => {
    expect(remainingCapacity([assignment({ allocationPct: 60 })], 'u1', DAY)).toBe(40);
  });

  it('never goes negative', () => {
    // Reporting -40 invites somebody adding it to a total.
    expect(remainingCapacity([assignment({ allocationPct: 140 })], 'u1', DAY)).toBe(0);
  });

  it('is a full week for somebody with nothing on', () => {
    expect(remainingCapacity([], 'u1', DAY)).toBe(100);
  });
});
