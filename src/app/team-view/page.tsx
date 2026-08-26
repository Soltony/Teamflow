
'use client';

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { TeamTasksManagement } from "@/components/tasks/team-tasks-management";
import { getTeamViewData } from "./actions";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import type { Task, User, Team, ProjectStatus, TaskUpdate, TaskStatus as TaskStatusType, Project } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useFirstLoad } from "@/hooks/use-first-load";
import { ErrorState } from "@/components/ui/error-state";
import { PageShell } from "@/components/ui/page-header";


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
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchTeamData = useCallback(async () => {
        if (!localUser?.id) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getTeamViewData(localUser.id);
            setViewData(data);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : "The request did not complete.");
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

    if (!localUser) {
        return (
            <PageShell>
                <ErrorState
                    variant="permission"
                    title="Your session has ended"
                    description="Sign in again to see your team's work."
                    href="/login"
                    hrefLabel="Sign in"
                />
            </PageShell>
        );
    }

    if (loadError || !viewData) {
        return (
            <PageShell>
                <ErrorState
                    variant="load"
                    title="We could not load your team view"
                    detail={loadError}
                    onRetry={fetchTeamData}
                />
            </PageShell>
        );
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
