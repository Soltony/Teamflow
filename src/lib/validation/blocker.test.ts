import { describe, expect, it } from 'vitest';

import {
  OPEN_BLOCKER_STATUSES,
  blockerTransitionError,
  canTransitionBlocker,
  createBlockerSchema,
  escalateBlockerSchema,
  isOpenBlocker,
  isOverdueBlocker,
  isUnmanaged,
  resolveBlockerSchema,
} from './blocker';

describe('createBlockerSchema', () => {
  const valid = {
    title: 'Vendor has not delivered licence keys',
    description: 'The supplier has missed two agreed dates for the production keys.',
    category: 'VENDOR' as const,
    severity: 'HIGH' as const,
  };

  it('accepts a complete issue', () => {
    expect(createBlockerSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a title that says something', () => {
    expect(createBlockerSchema.safeParse({ ...valid, title: 'aaa' }).success).toBe(false);
  });

  it('requires a description long enough to be useful', () => {
    expect(createBlockerSchema.safeParse({ ...valid, description: 'broken' }).success).toBe(false);
  });

  it('rejects a category it does not know', () => {
    expect(createBlockerSchema.safeParse({ ...valid, category: 'MADE_UP' }).success).toBe(false);
  });

  it('rejects a severity it does not know', () => {
    // Severity drives the register's ordering and the at-risk counts, so a
    // value outside the four must not reach the database.
    expect(createBlockerSchema.safeParse({ ...valid, severity: 'URGENT' }).success).toBe(false);
  });

  it('treats owner and due date as optional', () => {
    // Not every issue has an owner at the moment it is raised; the register
    // flags that separately rather than refusing to record the issue.
    const result = createBlockerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('trims whitespace so a title of spaces cannot pass', () => {
    expect(createBlockerSchema.safeParse({ ...valid, title: '        ' }).success).toBe(false);
  });
});

describe('resolveBlockerSchema', () => {
  it('requires a real resolution, not a full stop', () => {
    // Closing an issue with no explanation loses the only record of how it
    // was dealt with.
    expect(resolveBlockerSchema.safeParse({ resolution: '.' }).success).toBe(false);
    expect(
      resolveBlockerSchema.safeParse({ resolution: 'Keys delivered on the 14th.' }).success,
    ).toBe(true);
  });
});

describe('escalateBlockerSchema', () => {
  it('requires both a person and a reason', () => {
    expect(escalateBlockerSchema.safeParse({ escalatedToId: '', escalationReason: 'x'.repeat(20) }).success).toBe(false);
    expect(escalateBlockerSchema.safeParse({ escalatedToId: 'u1', escalationReason: 'no' }).success).toBe(false);
    expect(
      escalateBlockerSchema.safeParse({
        escalatedToId: 'u1',
        escalationReason: 'Two missed dates and UAT cannot start.',
      }).success,
    ).toBe(true);
  });
});

describe('canTransitionBlocker', () => {
  it('allows work to start and to be escalated', () => {
    expect(canTransitionBlocker('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionBlocker('IN_PROGRESS', 'ESCALATED')).toBe(true);
  });

  it('allows a resolved issue to be reopened', () => {
    // It happens. Refusing would push people into raising a duplicate, which
    // loses the history the register exists to keep.
    expect(canTransitionBlocker('RESOLVED', 'OPEN')).toBe(true);
  });

  it('refuses to move a resolved issue straight back into progress', () => {
    expect(canTransitionBlocker('RESOLVED', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionBlocker('CLOSED', 'ESCALATED')).toBe(false);
  });

  it('treats a no-op as allowed', () => {
    expect(canTransitionBlocker('OPEN', 'OPEN')).toBe(true);
  });

  it('names both states when it refuses', () => {
    expect(blockerTransitionError('RESOLVED', 'ESCALATED')).toContain('resolved');
    expect(blockerTransitionError('RESOLVED', 'ESCALATED')).toContain('escalated');
  });
});

describe('isOpenBlocker', () => {
  it('counts escalated and in-progress as still blocking', () => {
    // The bug this prevents: filtering on OPEN alone made an escalated
    // critical issue disappear from the at-risk figures.
    expect(isOpenBlocker('OPEN')).toBe(true);
    expect(isOpenBlocker('IN_PROGRESS')).toBe(true);
    expect(isOpenBlocker('ESCALATED')).toBe(true);
  });

  it('does not count resolved or closed', () => {
    expect(isOpenBlocker('RESOLVED')).toBe(false);
    expect(isOpenBlocker('CLOSED')).toBe(false);
  });

  it('agrees with the list the queries filter on', () => {
    for (const status of OPEN_BLOCKER_STATUSES) {
      expect(isOpenBlocker(status), status).toBe(true);
    }
    expect(OPEN_BLOCKER_STATUSES).toHaveLength(3);
  });
});

describe('isUnmanaged', () => {
  it('flags an open issue with no owner', () => {
    expect(isUnmanaged({ status: 'OPEN', severity: 'LOW', ownerId: null })).toBe(true);
  });

  it('flags a serious issue with an owner but no date', () => {
    expect(isUnmanaged({ status: 'OPEN', severity: 'CRITICAL', ownerId: 'u1', dueDate: null })).toBe(true);
    expect(isUnmanaged({ status: 'OPEN', severity: 'HIGH', ownerId: 'u1', dueDate: null })).toBe(true);
  });

  it('does not flag a low-severity issue that merely has no date', () => {
    expect(isUnmanaged({ status: 'OPEN', severity: 'LOW', ownerId: 'u1', dueDate: null })).toBe(false);
  });

  it('does not flag anything that is already resolved', () => {
    expect(isUnmanaged({ status: 'RESOLVED', severity: 'CRITICAL', ownerId: null })).toBe(false);
  });
});

describe('isOverdueBlocker', () => {
  const now = new Date('2026-06-15T09:00:00Z');

  it('is not overdue on the day it is due', () => {
    // Compared against the end of the due day, so something due today is not
    // late until today is over.
    expect(isOverdueBlocker({ status: 'OPEN', dueDate: '2026-06-15' }, now)).toBe(false);
  });

  it('is overdue the day after', () => {
    expect(isOverdueBlocker({ status: 'OPEN', dueDate: '2026-06-14' }, now)).toBe(true);
  });

  it('is not overdue when there is no date', () => {
    expect(isOverdueBlocker({ status: 'OPEN', dueDate: null }, now)).toBe(false);
  });

  it('is never overdue once resolved', () => {
    expect(isOverdueBlocker({ status: 'RESOLVED', dueDate: '2020-01-01' }, now)).toBe(false);
  });

  it('ignores an unparseable date rather than throwing', () => {
    expect(isOverdueBlocker({ status: 'OPEN', dueDate: 'not a date' }, now)).toBe(false);
  });

  it('handles a Date as well as a string', () => {
    expect(isOverdueBlocker({ status: 'OPEN', dueDate: new Date('2026-06-14') }, now)).toBe(true);
  });
});
