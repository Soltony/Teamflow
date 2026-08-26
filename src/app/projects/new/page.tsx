'use client';

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { getNewProjectData, createProject } from "../actions";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";

type NewProjectData = Awaited<ReturnType<typeof getNewProjectData>>;

/** Shaped like the wizard it stands in for: a step rail beside a panel. */
function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading the project form">
      <div className="p-4 sm:p-6 space-y-6 mx-auto w-full max-w-6xl">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <Skeleton className="h-72 w-full lg:w-[260px] lg:shrink-0" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export default function NewProjectPage() {
  const { hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<NewProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await getNewProjectData());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('projects:create')) {
        router.replace('/dashboard');
      } else {
        load();
      }
    }
  }, [authLoading, hasPermission, router, load]);

  const handleCreateProject = async (formData: any) => {
    const result = await createProject(formData);
    if (result.success) {
      toast({
        title: "Project created",
        description: `"${formData.name}" is now in the portfolio.`,
      });
      router.push('/projects');
    } else {
      toast({
        title: "The project was not created",
        // The action's own message where there is one: "failed, please try
        // again" tells somebody nothing they can act on.
        description: result.error ?? "Something went wrong saving it. Your entries are still here — try again.",
        variant: "destructive"
      });
    }
    return result;
  };

  if (loading || authLoading) {
    return <LoadingSkeleton />;
  }

  if (loadError || !data) {
    return (
      <PageShell>
        <ErrorState
          variant="load"
          title="We could not open the project form"
          description="The divisions, departments and statuses it needs did not load."
          detail={loadError}
          onRetry={load}
          href="/projects"
          hrefLabel="Back to projects"
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="mx-auto w-full max-w-6xl">
      <PageHeader
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'New project' }]}
        title="Register a new project"
        description="Five short steps. Milestones and payments can be left out now and added later."
      />
      <ProjectForm
        mode="create"
        users={data.users}
        pmoDivisions={data.pmoDivisions}
        departments={data.departments}
        projectStatuses={data.projectStatuses}
        onSubmit={handleCreateProject}
      />
    </PageShell>
  );
}
