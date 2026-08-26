import { describe, expect, it } from 'vitest';

import { anyFilterActive, emptyStateVariant, shouldOfferCreate } from './empty-state';

describe('emptyStateVariant', () => {
  it('says a genuinely empty collection is empty', () => {
    expect(emptyStateVariant({ filtersActive: false })).toBe('empty');
  });

  it('says a filtered-to-nothing list is a failed match', () => {
    // The defect this exists to stop: searching for a project that does not
    // exist told people to "get started by creating a new project", which
    // implies the portfolio is empty when it is not.
    expect(emptyStateVariant({ filtersActive: true })).toBe('no-match');
  });

  it('lets a filter win over the reader-scoped case', () => {
    // "You have no tasks" is wrong when you have simply filtered them out.
    expect(emptyStateVariant({ filtersActive: true, scopedToUser: true })).toBe('no-match');
  });

  it('treats an unfiltered personal list as a normal state', () => {
    // Having no tasks assigned is fine, not a problem to be dressed up.
    expect(emptyStateVariant({ filtersActive: false, scopedToUser: true })).toBe('none-yours');
  });
});

describe('shouldOfferCreate', () => {
  it('offers to create when the list is empty and the reader may', () => {
    expect(shouldOfferCreate({ filtersActive: false, canCreate: true })).toBe(true);
  });

  it('does not offer to create to somebody who cannot', () => {
    // Telling a read-only user to add a project is worse than saying nothing.
    expect(shouldOfferCreate({ filtersActive: false, canCreate: false })).toBe(false);
    expect(shouldOfferCreate({ filtersActive: false })).toBe(false);
  });

  it('does not offer to create when a filter is the reason nothing showed', () => {
    expect(shouldOfferCreate({ filtersActive: true, canCreate: true })).toBe(false);
  });

  it('does not offer to create on a personal list', () => {
    // You do not assign yourself a task by creating a project.
    expect(shouldOfferCreate({ filtersActive: false, scopedToUser: true, canCreate: true }))
      .toBe(false);
  });
});

describe('anyFilterActive', () => {
  it('ignores the neutral values the filter controls use', () => {
    expect(anyFilterActive('', null, undefined)).toBe(false);
    expect(anyFilterActive('all')).toBe(false);
    expect(anyFilterActive('ALL')).toBe(false);
  });

  it('ignores whitespace typed into a search box', () => {
    expect(anyFilterActive('   ')).toBe(false);
  });

  it('notices a real search term', () => {
    expect(anyFilterActive('core banking')).toBe(true);
  });

  it('notices a selected status alongside empty ones', () => {
    expect(anyFilterActive('', null, 'status-1')).toBe(true);
  });

  it('treats a non-empty array as filtering', () => {
    expect(anyFilterActive([])).toBe(false);
    expect(anyFilterActive(['dept-1'])).toBe(true);
  });

  it('treats an explicit boolean flag as filtering only when true', () => {
    expect(anyFilterActive(false)).toBe(false);
    expect(anyFilterActive(true)).toBe(true);
  });

  it('is false when nothing at all is passed', () => {
    expect(anyFilterActive()).toBe(false);
  });
});
