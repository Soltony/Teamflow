
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { MyTasksManagement } from "@/components/tasks/my-tasks-management";
import { getMyTasks } from './actions';
import type { UserTask } from './actions';
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
  return (
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
  )
}

export default function MyTasksPage() {
    const { localUser, loading: authLoading } = useAuth();
    const [tasksData, setTasksData] = useState<{ userTasks: UserTask[], allUsers: User[], todaysTasksCount: number } | null>(null);
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

    if (isLoading || authLoading) {
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
