'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { ApprovalsInbox } from '@/components/approvals/approvals-inbox';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader, PageShell } from '@/components/ui/page-header';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import { useFirstLoad } from '@/hooks/use-first-load';
import { getApprovalInbox } from './actions';
import { DEFAULT_SLA, type ApprovalItem, type ApprovalKind, type SlaThresholds } from '@/lib/approvals/types';

type Inbox = Awaited<ReturnType<typeof getApprovalInbox>>;

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading the approvals inbox">
      <PageShell>
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </PageShell>
    </LoadingRegion>
  );
}

export default function ApprovalsPage() {
  const { loading: authLoading } = useAuth();
  const [data, setData] = useState<Inbox | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setData(await getApprovalInbox());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchInbox();
  }, [authLoading, fetchInbox]);

  // Only on the very first load. Rendering the skeleton on every refresh
  // unmounted the page body, destroying any dialog that was open.
  const showSkeleton = useFirstLoad(isLoading);

  if (showSkeleton || authLoading) {
    return <LoadingSkeleton />;
  }

  const items: ApprovalItem[] = data?.items ?? [];
  const thresholds: SlaThresholds = data?.thresholds ?? DEFAULT_SLA;
  const visibleKinds: ApprovalKind[] = data?.visibleKinds ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Approvals"
        description={
          items.length > 0
            ? `Everything waiting on your decision, ordered by how close it is to the ${thresholds.slaDays}-day service level.`
            : 'Everything waiting on your decision, in one place.'
        }
      />

      {loadError ? (
        <ErrorState
          variant="load"
          title="We could not load your approvals"
          description="Nothing has been approved or sent back — the list simply did not arrive."
          detail={loadError}
          onRetry={fetchInbox}
        />
      ) : (
        <ApprovalsInbox
          items={items}
          thresholds={thresholds}
          visibleKinds={visibleKinds}
          onDataChange={fetchInbox}
        />
      )}
    </PageShell>
  );
}
