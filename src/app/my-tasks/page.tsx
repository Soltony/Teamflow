'use client';

import { useEffect, useState, useCallback } from 'react';

import { useAuth } from '@/context/auth-context';
import { MyTasksManagement } from "@/components/tasks/my-tasks-management";
import { getMyTasks } from './actions';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { PageShell } from '@/components/ui/page-header';
import { useFirstLoad } from "@/hooks/use-first-load";

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading your tasks">
      <PageShell>
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
      </PageShell>
    </LoadingRegion>
  )
}

export default function MyTasksPage() {
    const { localUser, loading: authLoading } = useAuth();
    /** Follows getMyTasks, so a change to the action shows up here as a type error. */
    type MyTasksData = Awaited<ReturnType<typeof getMyTasks>>;
    const [tasksData, setTasksData] = useState<MyTasksData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        if (!localUser?.id) return;

        setIsLoading(true);
        setLoadError(null);
        try {
            setTasksData(await getMyTasks(localUser.id));
        } catch (error) {
            // A thrown fetch used to leave the page saying "Could not load
            // tasks. Please try logging in again." — advice that is wrong for
            // every cause except an expired session.
            setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
        } finally {
            setIsLoading(false);
        }
    }, [localUser?.id]);

    useEffect(() => {
        if (localUser?.id) {
            fetchTasks();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [localUser, authLoading, fetchTasks]);

    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    if (!localUser) {
        return (
            <PageShell>
                <ErrorState
                    variant="permission"
                    title="Your session has ended"
                    description="Sign in again to see the tasks assigned to you."
                    href="/login"
                    hrefLabel="Sign in"
                />
            </PageShell>
        );
    }

    if (loadError || !tasksData) {
        return (
            <PageShell>
                <ErrorState
                    variant="load"
                    title="We could not load your tasks"
                    detail={loadError}
                    onRetry={fetchTasks}
                />
            </PageShell>
        );
    }

    return (
        <MyTasksManagement
            allUsers={tasksData.allUsers}
            currentUser={localUser}
            initialTasks={tasksData.userTasks}
            onDataChange={fetchTasks}
            todaysTasksCount={tasksData.todaysTasksCount}
        />
    );
}
