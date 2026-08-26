

'use client';

import { useEffect, useState, useCallback } from "react";
import { notFound, useRouter, useParams } from "next/navigation";
import { ProjectView } from "@/components/projects/project-view";
import {
  getProjectDetailsForUser,
  getBlockerOwnerOptions,
  addBlocker,
  resolveBlocker,
  escalateBlocker,
  deleteBlocker,
  updateBlocker,
  deleteProject,
} from "../actions";
import type { CreateBlockerInput, EscalateBlockerInput } from "@/lib/validation/blocker";
import { useAuth } from "@/context/auth-context";
import { BlockerStatus, TaskStatus, type Blocker, type Project } from "@/lib/types";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useFirstLoad } from "@/hooks/use-first-load";

type ProjectWithRelations = any;

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading">
          <div className="p-4 sm:p-6 space-y-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-48 w-full" />
              <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
              </div>
          </div>
        </LoadingRegion>
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
  const [blockerToDelete, setBlockerToDelete] = useState<Blocker | null>(null);
  const [editingBlocker, setEditingBlocker] = useState<Blocker | null>(null);
  const [escalatingBlocker, setEscalatingBlocker] = useState<Blocker | null>(null);
  const [blockerOwners, setBlockerOwners] = useState<{ id: string; name: string }[]>([]);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const canUpdateProject = hasPermission('projects:update');
  const canDeleteProject = hasPermission('projects:delete');

  const fetchProjectData = useCallback(async () => {
      if (!localUser?.id || !id) return;
      
      setIsLoading(true);
      const [data, owners] = await Promise.all([
        getProjectDetailsForUser(id, localUser.id),
        // Needed by the issue dialogs; fetched with the project so opening
        // one does not wait on a round trip.
        getBlockerOwnerOptions(),
      ]);
      setBlockerOwners(owners);
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
      setIsLoading(false);
  }, [id, localUser?.id]);


  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('projects:read')) {
        router.replace('/dashboard');
        return;
      }
      fetchProjectData();
    }
  }, [id, localUser, authLoading, hasPermission, router, fetchProjectData]);

  /** Every issue action reports failure rather than throwing, so surface it. */
  const report = (result: { success: boolean; error?: string }, ok: string) => {
    if (result.success) {
      toast({ title: ok });
    } else {
      toast({
        variant: "destructive",
        title: "That did not work",
        description: result.error ?? "Please try again.",
      });
    }
    return result.success;
  };

  const handleBlockerAdd = async (data: CreateBlockerInput) => {
    if (!project) return;
    setAddingBlocker(false);
    report(await addBlocker(project.id, data), "Issue raised");
    await fetchProjectData();
  };

  const handleBlockerResolve = async (blockerId: string, resolution: string) => {
    if (!project) return;
    setResolvingBlocker(null);
    report(await resolveBlocker(blockerId, resolution, project.id), "Issue resolved");
    await fetchProjectData();
  };

  const handleBlockerUpdate = async (blockerId: string, values: CreateBlockerInput) => {
    if (!project) return;
    setEditingBlocker(null);
    report(await updateBlocker(blockerId, project.id, values), "Issue updated");
    await fetchProjectData();
  };

  const handleBlockerEscalate = async (blockerId: string, values: EscalateBlockerInput) => {
    if (!project) return;
    setEscalatingBlocker(null);
    report(await escalateBlocker(blockerId, project.id, values), "Issue escalated");
    await fetchProjectData();
  };
  const handleBlockerDelete = async () => {
    if (!project || !blockerToDelete) return;
    const result = await deleteBlocker(blockerToDelete.id, project.id);
    setBlockerToDelete(null);
    report(result, "Issue deleted");
    await fetchProjectData();
  };

  const handleProjectDelete = async () => {
    if (!projectToDelete) return;
    const result = await deleteProject(projectToDelete.id);
    if (result.success) {
      toast({
        title: "Project Deleted",
        description: `The project "${projectToDelete.name}" has been permanently removed.`,
      });
      router.push('/projects');
    } else {
      toast({
        title: "Error Deleting Project",
        description: result.error,
        variant: "destructive",
      });
    }
    setProjectToDelete(null);
  };
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);
  
  if (showSkeleton || authLoading) {
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
        canDeleteProject={canDeleteProject}
        onAddBlocker={() => setAddingBlocker(true)}
        onResolveBlocker={(blocker) => setResolvingBlocker(blocker)}
        onEditBlocker={(blocker) => setEditingBlocker(blocker)}
        onDeleteBlocker={(blocker) => setBlockerToDelete(blocker)}
        onEscalateBlocker={(blocker) => setEscalatingBlocker(blocker)}
        blockerOwners={blockerOwners}
        escalatingBlocker={escalatingBlocker}
        onEscalateBlockerOpenChange={setEscalatingBlocker}
        onBlockerEscalateSubmit={handleBlockerEscalate}
        onDeleteProject={(project) => setProjectToDelete(project)}
        isAddingBlocker={isAddingBlocker}
        onAddBlockerOpenChange={setAddingBlocker}
        onBlockerAddSubmit={handleBlockerAdd}
        resolvingBlocker={resolvingBlocker}
        onResolveBlockerOpenChange={setResolvingBlocker}
        onBlockerResolveSubmit={handleBlockerResolve}
        editingBlocker={editingBlocker}
        onEditBlockerOpenChange={setEditingBlocker}
        onBlockerUpdateSubmit={handleBlockerUpdate}
        blockerToDelete={blockerToDelete}
        onDeleteBlockerOpenChange={setBlockerToDelete}
        onBlockerDeleteSubmit={handleBlockerDelete}
        projectToDelete={projectToDelete}
        onDeleteProjectOpenChange={setProjectToDelete}
        onProjectDeleteSubmit={handleProjectDelete}
    />
  );
}
