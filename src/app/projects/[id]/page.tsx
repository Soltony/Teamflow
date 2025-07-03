'use client';

import { useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { ProjectView } from "@/components/projects/project-view";
import { getProjectDetailsForUser } from "../actions";
import { useAuth } from "@/context/auth-context";
import { BlockerStatus, TaskStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

type ProjectWithRelations = any;

function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
}

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const { localUser, loading: authLoading, hasPermission } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('projects:read')) {
        router.replace('/dashboard');
        return;
      }
      
      if (localUser?.id && params.id) {
        setIsLoading(true);
        getProjectDetailsForUser(params.id, localUser.id)
            .then(data => {
                if (data) {
                    const normalizedProject = {
                        ...data,
                        milestones: data.milestones.map((m: any) => ({
                            ...m,
                            tasks: m.tasks.map((t: any) => ({
                                ...t,
                                status: t.status as TaskStatus,
                                assignedUserIds: t.assignees.map((a: any) => a.id),
                            }))
                        })),
                        blockers: data.blockers.map((b: any) => ({
                            ...b,
                            status: b.status as BlockerStatus,
                        }))
                    };
                    setProject(normalizedProject);
                } else {
                    notFound();
                }
            })
            .finally(() => setIsLoading(false));
      } else {
          setIsLoading(false);
      }
    }
  }, [localUser, authLoading, hasPermission, router, params.id]);

  if (isLoading || authLoading) {
      return <LoadingSkeleton />;
  }
  
  if (!project) {
      return null;
  }

  return <ProjectView initialProject={project} />;
}
