
'use client';

import { useEffect, useState } from "react";
import { notFound, useRouter, useParams } from "next/navigation";
import { ProjectView } from "@/components/projects/project-view";
import { getProjectDetailsForUser, addBlocker, resolveBlocker } from "../actions";
import { useAuth } from "@/context/auth-context";
import { BlockerStatus, TaskStatus, type Blocker } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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

export default function ProjectDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { localUser, loading: authLoading, hasPermission } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addingBlocker, setAddingBlocker] = useState(false);
  const [resolvingBlocker, setResolvingBlocker] = useState<Blocker | null>(null);

  const canUpdateProject = hasPermission('projects:update');

  const handleBlockerAdd = async (data: { description: string }) => {
    setAddingBlocker(false);
    await addBlocker(project.id, data.description);
    toast({
      title: "Blocker Added",
      description: "The project blocker has been recorded and is now visible to management.",
    });
    router.refresh();
  };

  const handleBlockerResolve = async (blockerId: string, resolution: string) => {
    setResolvingBlocker(null);
    await resolveBlocker(blockerId, resolution, project.id);
    toast({
      title: "Blocker Resolved",
      description: "The blocker has been marked as resolved.",
    });
    router.refresh();
  };
  
  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('projects:read')) {
        router.replace('/dashboard');
        return;
      }
      
      if (localUser?.id && id) {
        setIsLoading(true);
        getProjectDetailsForUser(id, localUser.id)
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
  }, [id, localUser, authLoading, hasPermission, router]);

  if (isLoading || authLoading) {
      return <LoadingSkeleton />;
  }
  
  if (!project) {
      return null;
  }

  return (
    <ProjectView 
        project={project}
        canUpdateProject={canUpdateProject}
        onAddBlocker={() => setAddingBlocker(true)}
        onResolveBlocker={(blocker) => setResolvingBlocker(blocker)}
        isAddingBlocker={addingBlocker}
        onAddBlockerOpenChange={setAddingBlocker}
        onBlockerAddSubmit={handleBlockerAdd}
        resolvingBlocker={resolvingBlocker}
        onResolveBlockerOpenChange={setResolvingBlocker}
        onBlockerResolveSubmit={handleBlockerResolve}
    />
  );
}
