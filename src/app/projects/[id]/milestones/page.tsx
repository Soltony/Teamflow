'use client';

import { useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
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

export default function ProjectMilestonesPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { localUser, loading: authLoading, hasPermission } = useAuth();
    const router = useRouter();
    const [pageData, setPageData] = useState<PageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('milestones:view')) {
                router.replace('/dashboard');
                return;
            }

            if (localUser?.id && id) {
                setIsLoading(true);
                getProjectMilestonesForUser(id, localUser.id)
                    .then(data => {
                        if (data) {
                             const normalizedProject = {
                                ...data.project,
                                milestones: data.project.milestones.map((m: any) => ({
                                ...m,
                                responsibleDepartmentIds: m.responsibleDepartments.map((d: any) => d.id),
                                tasks: m.tasks.map((t: any) => ({
                                    ...t,
                                    status: t.status as TaskStatus,
                                    assignedUserIds: t.assignees.map((a: any) => a.id),
                                }))
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
                    })
                    .finally(() => setIsLoading(false));
            } else {
                setIsLoading(false);
            }
        }
    }, [localUser, authLoading, hasPermission, router, id]);

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
        />
    );
}
