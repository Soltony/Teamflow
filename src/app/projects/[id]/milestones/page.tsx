

'use client';

import { useEffect, useState, useCallback } from "react";
import { notFound, useRouter, useParams } from "next/navigation";
import { ProjectMilestones } from "@/components/projects/project-milestones";
import { getProjectMilestonesForUser } from "../../actions";
import { useAuth } from "@/context/auth-context";
import { TaskStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Department } from "@/lib/types";

type PageData = {
    project: any;
    users: User[];
    departments: Department[];
};

function LoadingSkeleton() {
     return (
        <div className="p-4 sm:p-6 space-y-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

export default function ProjectMilestonesPage() {
    const params = useParams();
    const id = params.id as string;

    const { localUser, loading: authLoading, hasPermission } = useAuth();
    const router = useRouter();
    const [pageData, setPageData] = useState<PageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!localUser?.id || !id) return;

        setIsLoading(true);
        try {
            const data = await getProjectMilestonesForUser(id, localUser.id);
            if (data) {
                const normalizedProject = {
                    ...data.project,
                    milestones: data.project.milestones.map((m: any) => ({
                        ...m,
                        tasks: m.tasks.map((t: any) => {
                            const assignedUserIds = t.assignees.map((a: any) => a.id);
                            console.log('Milestones page - normalizing task:', t.id, 'assignees:', t.assignees, 'assignedUserIds:', assignedUserIds);
                            return {
                                ...t,
                                status: t.status as TaskStatus,
                                assignedUserIds: assignedUserIds,
                            };
                        })
                    }))
                };
                setPageData({
                    project: normalizedProject,
                    users: data.users,
                    departments: data.departments
                });
            } else {
                notFound();
            }
        } catch (error) {
            console.error("Failed to fetch project milestones data:", error);
            setPageData(null);
        } finally {
            setIsLoading(false);
        }
    }, [id, localUser?.id]);


    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('milestones:view')) {
                router.replace('/dashboard');
                return;
            }
            fetchData();
        }
    }, [authLoading, hasPermission, router, fetchData]);

    if (isLoading || authLoading) {
        return <LoadingSkeleton />;
    }

    if (!pageData) {
        return null;
    }

    return (
        <ProjectMilestones 
            initialProject={pageData.project}
            users={pageData.users}
            departments={pageData.departments}
            fetchData={fetchData}
        />
    );
}
