
'use client';

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { TeamTasksManagement } from "@/components/tasks/team-tasks-management";
import { getTeamViewData } from "./actions";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import type { Task, User, Team, ProjectStatus, TaskUpdate, TaskStatus as TaskStatusType, Project } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useFirstLoad } from "@/hooks/use-first-load";


export type TeamViewTask = Task & {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
  updates: (TaskUpdate & { progressPercentage: number | null })[];
};

export type ProjectWithTasksAndStats = {
    project: Project & {
        statusId: string | null;
        createdAt: Date;
    };
    tasks: TeamViewTask[];
    stats: {
        pending: number;
        inProgress: number;
        done: number;
        todo: number;
        total: number;
    }
}

type TeamViewData = {
    allUsers: User[];
    ledTeams: Team[];
    tasksByProject: ProjectWithTasksAndStats[];
    projectStatuses: ProjectStatus[];
}

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading team view">
      <div className="p-4 sm:p-6 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
      </div>
    </LoadingRegion>
  )
}

export default function TeamViewPage() {
    const { localUser, loading: authLoading, hasPermission } = useAuth();
    const router = useRouter();
    /** Follows getTeamViewData rather than restating its shape by hand. */
    type LoadedTeamViewData = Awaited<ReturnType<typeof getTeamViewData>>;
    const [viewData, setViewData] = useState<LoadedTeamViewData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTeamData = useCallback(async () => {
        if (!localUser?.id) return;
        setIsLoading(true);
        try {
            const data = await getTeamViewData(localUser.id);
            setViewData(data);
        } catch (error) {
            console.error("Failed to fetch team view data", error);
        } finally {
            setIsLoading(false);
        }
    }, [localUser?.id]);


    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('team-view:view')) {
                router.replace('/dashboard');
                return;
            }

            if (localUser?.id) {
                fetchTeamData();
            } else {
                setIsLoading(false);
            }
        }
    }, [localUser, authLoading, hasPermission, router, fetchTeamData]);
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    if (!localUser || !viewData) {
        return (
             <div className="p-4 sm:p-6">
                <p>Could not load team view. Please try logging in again.</p>
            </div>
        )
    }

  return (
    <TeamTasksManagement 
        allUsers={viewData.allUsers}
        ledTeams={viewData.ledTeams}
        currentUser={localUser}
        initialTasksByProject={viewData.tasksByProject}
        projectStatuses={viewData.projectStatuses}
        onDataChange={fetchTeamData}
    />
  );
}
