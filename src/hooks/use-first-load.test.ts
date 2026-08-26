import { describe, expect, it } from 'vitest';

import { shouldShowSkeleton } from './use-first-load';

describe('shouldShowSkeleton', () => {
  it('shows the skeleton while the first load is in flight', () => {
    expect(shouldShowSkeleton(true, false)).toBe(true);
  });

  it('hides it once that load finishes', () => {
    expect(shouldShowSkeleton(false, true)).toBe(false);
  });

  it('keeps the content on screen during a refresh', () => {
    // The whole point. The old condition was `isLoading || authLoading`, so a
    // refresh replaced the page with a skeleton and unmounted every open
    // dialog — including the one holding a freshly reset password.
    expect(shouldShowSkeleton(true, true)).toBe(false);
  });

  it('does not show a skeleton before anything has been asked for', () => {
    // Not loading and never loaded: an idle page with nothing requested yet.
    // It should render its empty state, not a skeleton that never resolves.
    expect(shouldShowSkeleton(false, false)).toBe(false);
  });

  it('never returns to the skeleton once content has been shown', () => {
    // Simulates a page loading, then refreshing several times.
    let hasLoaded = false;
    const sequence: boolean[] = [];
    for (const isLoading of [true, false, true, false, true, true, false]) {
      if (!isLoading) hasLoaded = true;
      sequence.push(shouldShowSkeleton(isLoading, hasLoaded));
    }
    expect(sequence).toEqual([true, false, false, false, false, false, false]);
  });
});

/**
 * The pattern this hook replaced, guarded at the source.
 *
 * The bug was not in one page: twenty of them rendered their skeleton whenever
 * a fetch was in flight, so any background refresh unmounted the page body. A
 * unit test of the logic cannot catch a page that simply does not use it.
 */
describe('no page unmounts itself on a background refresh', () => {
  const { readdirSync, readFileSync, statSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');

  function pageFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) pageFiles(p, out);
      else if (entry === 'page.tsx') out.push(p);
    }
    return out;
  }

  it('renders a skeleton only until the first load completes', () => {
    const offenders = pageFiles('src/app').filter((f) => {
      const source = readFileSync(f, 'utf8');
      // The old shape: gate the whole body on the in-flight flag.
      return /if \(\s*isLoading\s*\|\|/.test(source);
    });

    expect(
      offenders,
      `These pages replace their content with a skeleton on every refresh, ` +
        `which unmounts any open dialog: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('uses the shared hook wherever a page has a loading flag', () => {
    const missing = pageFiles('src/app').filter((f) => {
      const source = readFileSync(f, 'utf8');
      if (!source.includes('setIsLoading')) return false;
      return !source.includes('useFirstLoad');
    });

    expect(missing, `Pages with a loading flag but no first-load guard: ${missing.join(', ')}`)
      .toEqual([]);
  });
});
