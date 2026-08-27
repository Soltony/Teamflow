'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { getPendingApprovalCount } from '@/app/approvals/actions';
import { useAuth } from '@/context/auth-context';
import { APPROVAL_PERMISSIONS } from '@/components/navigation';

/**
 * How many decisions are waiting on this person, for the sidebar badge.
 *
 * The point of the badge is that somebody who has not opened the inbox still
 * knows there is something in it — the three old queues gave no signal at all,
 * so work sat there until somebody thought to look.
 *
 * Refetched when the route changes rather than on a timer. Approving something
 * navigates or refreshes, which is exactly when the number is stale; a poll
 * would spend a query every thirty seconds on a number that changes a few
 * times a day.
 */
export function useApprovalCount(): number | null {
  const { localUser, hasPermission, loading } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = React.useState<number | null>(null);

  // Nobody without an approval permission should cost a query.
  const eligible = !loading && Boolean(localUser) && hasPermission(APPROVAL_PERMISSIONS);

  React.useEffect(() => {
    if (!eligible) {
      setCount(null);
      return;
    }

    let cancelled = false;
    getPendingApprovalCount()
      .then((value) => {
        if (!cancelled) setCount(value);
      })
      // A badge is decoration. If the count cannot be fetched, show no badge
      // rather than an error — the inbox itself reports properly when opened.
      .catch(() => {
        if (!cancelled) setCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [eligible, pathname]);

  return count;
}
