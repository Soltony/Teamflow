
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { MyTasksManagement } from "@/components/tasks/my-tasks-management";
import { getMyTasks } from './actions';
import type { UserTask } from './actions';
import type { User } from '@/lib/types';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import { useFirstLoad } from "@/hooks/use-first-load";

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading my tasks">
      <div className="p-4 sm:p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-96" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64 w-full" />
      </div>
    </LoadingRegion>
  )
}

export default function MyTasksPage() {
    const { localUser, loading: authLoading } = useAuth();
    /** Follows getMyTasks, so a change to the action shows up here as a type error. */
    type MyTasksData = Awaited<ReturnType<typeof getMyTasks>>;
    const [tasksData, setTasksData] = useState<MyTasksData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTasks = useCallback(async () => {
        if (localUser?.id) {
            setIsLoading(true);
            const data = await getMyTasks(localUser.id);
            setTasksData(data);
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

    if (!localUser || !tasksData) {
        return (
             <div className="p-4 sm:p-6">
                <p>Could not load tasks. Please try logging in again.</p>
            </div>
        )
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
