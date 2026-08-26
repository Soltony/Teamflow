'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import { TimelineApprovalManagement } from "@/components/timeline-approvals/timeline-approvals-management";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { ApprovalQueueIntro } from "@/components/ui/action-required";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { getPendingTimelineChanges } from "./actions";
import { useFirstLoad } from "@/hooks/use-first-load";

// Derived from the action. The hand-written version restated the Prisma row,
// so its dates were Dates while the values arriving here are strings — which
// is why this needed a cast to compile at all.
type PendingRequestWithRelations = Awaited<ReturnType<typeof getPendingTimelineChanges>>[number];

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading deadline change requests">
          <PageShell>
            <div className="space-y-2">
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Card>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </PageShell>
        </LoadingRegion>
    );
}

export default function TimelineApprovalsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pendingRequests, setPendingRequests] = useState<PendingRequestWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            setPendingRequests(await getPendingTimelineChanges());
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('timeline:approve')) {
                router.replace('/dashboard');
            } else {
                fetchData();
            }
        }
    }, [authLoading, hasPermission, router, fetchData]);

    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    return (
        <PageShell>
          <PageHeader
            title="Deadline changes"
            description="Requests to move a project's committed end date, waiting on your decision."
          />

          {loadError ? (
            <ErrorState
              variant="load"
              title="We could not load the request queue"
              description="Nothing has been approved or refused — the list simply did not arrive."
              detail={loadError}
              onRetry={fetchData}
            />
          ) : (
            <>
              <ApprovalQueueIntro
                count={pendingRequests.length}
                noun="deadline change"
                whatApprovalDoes="Approving rewrites the project's end date. The original commitment stays on record as the baseline, so the project is still reported against what was first agreed."
                whatRejectionDoes="Refusing leaves the current deadline in place and sends your reason back to whoever asked."
              />

              <Card>
                <CardContent className="pt-6">
                  <TimelineApprovalManagement
                    initialRequests={pendingRequests}
                    onDataChange={fetchData}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </PageShell>
    );
}
