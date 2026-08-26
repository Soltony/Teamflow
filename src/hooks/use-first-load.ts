'use client';

import { useRef } from 'react';

/**
 * Whether a page is still waiting for its very first data.
 *
 * Every page in this application rendered its skeleton whenever `isLoading` was
 * true — which is also true on every background refresh. That unmounted the
 * whole page body, and with it every dialog, expanded row and filter the person
 * was in the middle of using.
 *
 * The worst case was resetting a password. The dialog opened, the reset
 * succeeded, the list refreshed, the page swapped itself for a skeleton, and
 * the dialog carrying the only copy of the temporary password was destroyed
 * before anyone could read it — leaving an account whose password nobody knew.
 *
 * A refresh with data already on screen should leave that content alone.
 */

/**
 * The decision, separated from the hook so it can be tested directly.
 *
 * @param isLoading    A fetch is in flight.
 * @param hasLoadedOnce A fetch has completed at least once.
 */
export function shouldShowSkeleton(isLoading: boolean, hasLoadedOnce: boolean): boolean {
  // Once something has been shown, keep showing it while refreshing. Replacing
  // it with a skeleton throws away whatever the person was doing.
  if (hasLoadedOnce) return false;
  return isLoading;
}

/**
 * ```ts
 * const showSkeleton = useFirstLoad(isLoading);
 * if (showSkeleton || authLoading) return <LoadingSkeleton />;
 * ```
 */
export function useFirstLoad(isLoading: boolean): boolean {
  const hasLoadedOnce = useRef(false);
  // A completed load is recorded during render rather than in an effect: the
  // guard below runs in this same pass, and an effect would be a render too
  // late, flashing the skeleton once more.
  if (!isLoading) hasLoadedOnce.current = true;
  return shouldShowSkeleton(isLoading, hasLoadedOnce.current);
}
