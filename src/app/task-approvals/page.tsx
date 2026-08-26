'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { ApprovalQueueIntro } from "@/components/ui/action-required";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { getPendingReviewTasks } from "./actions";
import { TaskApprovalManagement } from "@/components/task-approvals/task-approvals-management";
import { useFirstLoad } from "@/hooks/use-first-load";

/** Matches the queue's shape: a banner, a toolbar, then rows. */
function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading tasks awaiting review">
          <PageShell>
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
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

export default function TaskApprovalsPage() {
    const { localUser, hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pendingTasks, setPendingTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!localUser?.id) return;

        setIsLoading(true);
        setLoadError(null);
        try {
            setPendingTasks(await getPendingReviewTasks(localUser.id));
        } catch (error) {
            // Previously logged to the console and left the page showing an
            // empty queue, which reads as "nothing to do" — the opposite of
            // what had happened.
            setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
        } finally {
            setIsLoading(false);
        }
    }, [localUser?.id]);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('tasks:approve')) {
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
            title="Task approvals"
            description="Work your team has marked complete, waiting on your decision before it counts."
          />

          {loadError ? (
            <ErrorState
              variant="load"
              title="We could not load the review queue"
              description="Nothing has been approved or refused — the list simply did not arrive."
              detail={loadError}
              onRetry={fetchData}
            />
          ) : (
            <>
              <ApprovalQueueIntro
                count={pendingTasks.length}
                noun="task"
                whatApprovalDoes="Approving marks a task done, closes it out of its assignee's list, and counts its weight towards the milestone's progress."
                whatRejectionDoes="Sending one back returns it to In progress with your reason attached, so the assignee knows what to fix."
              />

              <Card>
                <CardContent className="pt-6">
                  <TaskApprovalManagement
                    initialTasks={pendingTasks}
                    onDataChange={fetchData}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </PageShell>
    );
}
