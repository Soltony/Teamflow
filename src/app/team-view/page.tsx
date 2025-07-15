
'use client';

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { TeamTasksManagement } from "@/components/tasks/team-tasks-management";
import { getTeamViewData } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task, User, Team, ProjectStatus, TaskUpdate, TaskStatus as TaskStatusType } from "@/lib/types";
import { useRouter } from "next/navigation";


export type TeamViewTask = Task & {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
  updates: (TaskUpdate & { progressPercentage: number | null })[];
};

export type ProjectWithTasksAndStats = {
    project: {
        id: string;
        name: string;
        statusId: string | null;
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
    <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
    </div>
  )
}

export default function TeamViewPage() {
    const { localUser, loading: authLoading, hasPermission } = useAuth();
    const router = useRouter();
    const [viewData, setViewData] = useState<TeamViewData | null>(null);
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

    if (isLoading || authLoading) {
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
