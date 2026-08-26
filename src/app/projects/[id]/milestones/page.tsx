

'use client';

import { useEffect, useState, useCallback } from "react";
import { notFound, useRouter, useParams } from "next/navigation";
import { ProjectMilestones } from "@/components/projects/project-milestones";
import { getProjectMilestonesForUser } from "../../actions";
import { useAuth } from "@/context/auth-context";
import { TaskStatus, UserWithRoles } from "@/lib/types";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import type { Department } from "@/lib/types";
import { useFirstLoad } from "@/hooks/use-first-load";
import { ErrorState } from "@/components/ui/error-state";
import { PageShell } from "@/components/ui/page-header";

type PageData = {
    project: any;
    users: UserWithRoles[];
    departments: Department[];
};

function LoadingSkeleton() {
     return (
        <LoadingRegion label="Loading">
          <div className="p-4 sm:p-6 space-y-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
          </div>
        </LoadingRegion>
    );
}

export default function ProjectMilestonesPage() {
    const params = useParams();
    const id = params.id as string;

    const { localUser, loading: authLoading, hasPermission } = useAuth();
    const router = useRouter();
    const [pageData, setPageData] = useState<PageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!localUser?.id || !id) return;

        setIsLoading(true);
        setLoadError(null);
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
            setLoadError(error instanceof Error ? error.message : "The request did not complete.");
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
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    // `return null` rendered a blank white page whenever the fetch failed,
    // with nothing to say what had happened or how to get out of it.
    if (loadError || !pageData) {
        return (
            <PageShell>
                <ErrorState
                    variant="load"
                    title="We could not load these milestones"
                    detail={loadError}
                    onRetry={fetchData}
                    href={`/projects/${id}`}
                    hrefLabel="Back to the project"
                />
            </PageShell>
        );
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
