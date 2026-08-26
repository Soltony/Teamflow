import { describe, expect, it } from 'vitest';

import { availablePermissions } from './permissions';
import {
  describePermissions,
  summarisePermissions,
  unknownPermissions,
} from './permissions-summary';

describe('summarisePermissions', () => {
  it('says nothing about a group with nothing granted', () => {
    // A summary should say what a role can do, not list what it cannot.
    const summary = summarisePermissions(['dashboard:view']);
    expect(summary).toHaveLength(1);
    expect(summary[0].group).toBe('Dashboard');
  });

  it('counts how much of a group is granted', () => {
    const teams = availablePermissions['Teams'];
    const summary = summarisePermissions([teams[0], teams[1]]);
    const entry = summary.find((s) => s.group === 'Teams')!;
    expect(entry.granted).toBe(2);
    expect(entry.total).toBe(teams.length);
    expect(entry.complete).toBe(false);
  });

  it('marks a group complete when every permission in it is granted', () => {
    const summary = summarisePermissions([...availablePermissions['Teams']]);
    expect(summary.find((s) => s.group === 'Teams')!.complete).toBe(true);
  });

  it('ignores a permission the registry no longer declares', () => {
    // A role saved before a permission was removed should not render an
    // unnamed group.
    const summary = summarisePermissions(['dashboard:view', 'removed:permission']);
    expect(summary).toHaveLength(1);
  });

  it('returns nothing for a role with no permissions', () => {
    expect(summarisePermissions([])).toEqual([]);
  });
});

describe('describePermissions', () => {
  it('says so plainly when there are none', () => {
    expect(describePermissions([])).toBe('No permissions');
  });

  it('names a group the role has in full', () => {
    expect(describePermissions([...availablePermissions['Teams']])).toContain('Full access to Teams');
  });

  it('gives a proportion for a partial group', () => {
    const teams = availablePermissions['Teams'];
    expect(describePermissions([teams[0]])).toContain(`1 of ${teams.length} in Teams`);
  });

  it('joins several full groups readably', () => {
    const text = describePermissions([
      ...availablePermissions['Teams'],
      ...availablePermissions['Dashboard'],
    ]);
    expect(text).toMatch(/Teams and Dashboard|Dashboard and Teams/);
  });

  it('is shorter than printing every permission', () => {
    // The thing this replaces: thirty-four comma-separated tokens.
    const all = Object.values(availablePermissions).flat();
    expect(describePermissions(all).length).toBeLessThan(all.join(', ').length);
  });
});

describe('unknownPermissions', () => {
  it('finds a permission that is no longer declared', () => {
    expect(unknownPermissions(['dashboard:view', 'ghost:permission'])).toEqual(['ghost:permission']);
  });

  it('finds none when every permission is current', () => {
    expect(unknownPermissions(Object.values(availablePermissions).flat())).toEqual([]);
  });
});
