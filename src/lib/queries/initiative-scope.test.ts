import { describe, expect, it } from 'vitest';

import {
  UNASSIGNED_INITIATIVE,
  groupByInitiative,
  initiativeKeyOf,
  projectsForInitiative,
} from './initiative-scope';

const initiatives = [
  { id: 'in-1', name: 'Digital Transformation' },
  { id: 'in-2', name: 'Customer Experience' },
];

describe('projectsForInitiative', () => {
  it('matches one initiative', () => {
    expect(projectsForInitiative('in-1')).toEqual({ initiativeId: 'in-1' });
  });

  it('matches the projects under no initiative', () => {
    // The question the register exists to answer, and one a filter offering
    // only the initiatives themselves could never ask.
    expect(projectsForInitiative(UNASSIGNED_INITIATIVE)).toEqual({ initiativeId: null });
  });
});

describe('initiativeKeyOf', () => {
  it('reads the flat column', () => {
    expect(initiativeKeyOf({ initiativeId: 'in-1' })).toBe('in-1');
  });

  it('reads the included relation', () => {
    expect(initiativeKeyOf({ initiative: { id: 'in-2' } })).toBe('in-2');
  });

  it('places a project with neither under the unassigned key', () => {
    expect(initiativeKeyOf({ initiativeId: null })).toBe(UNASSIGNED_INITIATIVE);
    expect(initiativeKeyOf({})).toBe(UNASSIGNED_INITIATIVE);
  });
});

describe('groupByInitiative', () => {
  const projects = [
    { id: 'p-1', initiativeId: 'in-1' },
    { id: 'p-2', initiativeId: 'in-1' },
    { id: 'p-3', initiativeId: 'in-2' },
    { id: 'p-4', initiativeId: null },
  ];

  it('gives every project exactly one row, so the rows sum to the portfolio', () => {
    // The property that separates initiatives from divisions: a project has
    // any number of divisions but at most one initiative, so these counts are
    // a partition rather than an overlapping tally.
    const rows = groupByInitiative(projects, initiatives);
    const counted = rows.reduce((sum, row) => sum + row.projects.length, 0);
    expect(counted).toBe(projects.length);
    const ids = rows.flatMap((r) => r.projects.map((p) => p.id));
    expect(new Set(ids).size).toBe(projects.length);
  });

  it('keeps an initiative with nothing under it', () => {
    // An initiative on record that no project delivers against is a finding,
    // not a row to hide.
    const rows = groupByInitiative([], initiatives);
    expect(rows.map((r) => r.name)).toEqual(['Digital Transformation', 'Customer Experience']);
    expect(rows.every((r) => r.projects.length === 0)).toBe(true);
  });

  it('adds the unassigned row only when something is in it', () => {
    const withOrphans = groupByInitiative(projects, initiatives);
    expect(withOrphans.at(-1)).toMatchObject({ id: UNASSIGNED_INITIATIVE, unassigned: true });

    const allPlaced = groupByInitiative(projects.slice(0, 3), initiatives);
    expect(allPlaced.some((r) => r.unassigned)).toBe(false);
  });

  it('counts a project whose initiative is not in the list rather than dropping it', () => {
    // Happens when the list is scoped and the project is not: the row totals
    // must still add up to the set that was handed in.
    const rows = groupByInitiative([{ id: 'p-9', initiativeId: 'in-gone' }], initiatives);
    const counted = rows.reduce((sum, row) => sum + row.projects.length, 0);
    expect(counted).toBe(1);
    expect(rows.at(-1)?.unassigned).toBe(true);
  });

  it('preserves the order the initiatives were given in', () => {
    const rows = groupByInitiative(projects, initiatives);
    expect(rows.slice(0, 2).map((r) => r.id)).toEqual(['in-1', 'in-2']);
  });
});
