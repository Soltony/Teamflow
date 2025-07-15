
'use client';

import { useEffect, useState, useCallback } from "react";
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
  const [isAddingBlocker, setAddingBlocker] = useState(false);
  const [resolvingBlocker, setResolvingBlocker] = useState<Blocker | null>(null);

  const canUpdateProject = hasPermission('projects:update');

  const fetchProjectData = useCallback(async () => {
      if (!localUser?.id || !id) return;
      
      const data = await getProjectDetailsForUser(id, localUser.id);
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
  }, [id, localUser?.id]);


  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('projects:read')) {
        router.replace('/dashboard');
        return;
      }
      
      setIsLoading(true);
      fetchProjectData().finally(() => setIsLoading(false));
    }
  }, [id, localUser, authLoading, hasPermission, router, fetchProjectData]);

  const handleBlockerAdd = async (data: { description: string }) => {
    if (!project) return;
    setAddingBlocker(false);
    await addBlocker(project.id, data.description);
    toast({
      title: "Blocker Added",
      description: "The project blocker has been recorded.",
    });
    await fetchProjectData(); // Re-fetch data
  };

  const handleBlockerResolve = async (blockerId: string, resolution: string) => {
    if (!project) return;
    setResolvingBlocker(null);
    await resolveBlocker(blockerId, resolution, project.id);
    toast({
      title: "Blocker Resolved",
      description: "The blocker has been marked as resolved.",
    });
    await fetchProjectData(); // Re-fetch data
  };
  
  if (isLoading || authLoading) {
      return <LoadingSkeleton />;
  }
  
  if (!project) {
      return (
        <div className="p-4 sm:p-6">
            <p>Could not load project data or you do not have permission to view it.</p>
        </div>
      );
  }

  return (
    <ProjectView 
        project={project}
        canUpdateProject={canUpdateProject}
        onAddBlocker={() => setAddingBlocker(true)}
        onResolveBlocker={(blocker) => setResolvingBlocker(blocker)}
        isAddingBlocker={isAddingBlocker}
        onAddBlockerOpenChange={setAddingBlocker}
        onBlockerAddSubmit={handleBlockerAdd}
        resolvingBlocker={resolvingBlocker}
        onResolveBlockerOpenChange={setResolvingBlocker}
        onBlockerResolveSubmit={handleBlockerResolve}
    />
  );
}
