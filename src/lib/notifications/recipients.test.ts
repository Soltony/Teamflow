import { describe, expect, it } from 'vitest';

import { buildNotificationRows, resolveRecipients } from './recipients';

const ACTOR = 'user-actor';

describe('resolveRecipients', () => {
  it('never notifies the person who performed the action', () => {
    // Approving your own team's task should not put a message in your own bell.
    expect(resolveRecipients(['a', ACTOR, 'b'], ACTOR)).toEqual(['a', 'b']);
  });

  it('deduplicates someone who qualifies twice', () => {
    // A division approver who is also an assignee is one person. The old
    // per-call-site loops sent them the same sentence twice.
    expect(resolveRecipients(['a', 'b', 'a'], ACTOR)).toEqual(['a', 'b']);
  });

  it('accepts a Set, which is what the fan-out call sites build', () => {
    const set = new Set(['a', ACTOR, 'b']);
    expect(resolveRecipients(set, ACTOR)).toEqual(['a', 'b']);
  });

  it('drops empty ids rather than writing a row with no recipient', () => {
    expect(resolveRecipients(['a', '', 'b'], ACTOR)).toEqual(['a', 'b']);
  });

  it('returns nothing when the actor was the only candidate', () => {
    expect(resolveRecipients([ACTOR], ACTOR)).toEqual([]);
    expect(resolveRecipients([], ACTOR)).toEqual([]);
  });

  it('preserves the order candidates were offered in', () => {
    expect(resolveRecipients(['c', 'a', 'b'], ACTOR)).toEqual(['c', 'a', 'b']);
  });
});

describe('buildNotificationRows', () => {
  const draft = { message: 'Task approved.', link: '/tasks/1', senderId: ACTOR };

  it('gives every recipient the same message and link', () => {
    expect(buildNotificationRows(draft, ['a', 'b'])).toEqual([
      { message: 'Task approved.', link: '/tasks/1', recipientId: 'a', senderId: ACTOR },
      { message: 'Task approved.', link: '/tasks/1', recipientId: 'b', senderId: ACTOR },
    ]);
  });

  it('produces no rows when there is nobody to tell', () => {
    // The caller uses this to skip the database round trip entirely.
    expect(buildNotificationRows(draft, [ACTOR])).toEqual([]);
  });

  it('builds one row per recipient, which is what createMany writes in one statement', () => {
    const team = Array.from({ length: 12 }, (_, i) => `member-${i}`);
    expect(buildNotificationRows(draft, team)).toHaveLength(12);
  });
});
