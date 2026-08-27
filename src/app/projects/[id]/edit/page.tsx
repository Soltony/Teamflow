'use client';

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { parseISO } from "date-fns";

import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ProjectForm } from "@/components/projects/project-form";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getProjectForEdit, updateProject } from "../../actions";

// Derived from the action: the shape the browser receives, including the
// narrowed user columns. `project: any` hid the same disagreement.
type EditProjectData = NonNullable<Awaited<ReturnType<typeof getProjectForEdit>>>;

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading the project">
      <div className="p-4 sm:p-6 space-y-6 mx-auto w-full max-w-6xl">
        <div className="space-y-2">
          <Skeleton className="h-9 w-80" />
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

export default function EditProjectPage() {
  const { id } = useParams();
  const projectId = id as string;

  const { hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<EditProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fetched = await getProjectForEdit(projectId);
      setData(fetched ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('projects:update')) {
        router.replace('/dashboard');
      } else {
        load();
      }
    }
  }, [authLoading, hasPermission, router, load]);

  const handleUpdateProject = async (formData: any) => {
    // The conversion to Decimal happens on the server side in the action;
    // the form can send numbers.
    const result = await updateProject(projectId, formData);
    if (result.success) {
      toast({
        title: "Changes saved",
        description: `"${formData.name}" has been updated.`,
      });
      router.push(`/projects/${projectId}`);
    } else {
      toast({
        title: "The changes were not saved",
        description: result.error ?? "Something went wrong. Your entries are still here — try again.",
        variant: "destructive",
      });
    }
    return result;
  };

  if (loading || authLoading) {
    return <LoadingSkeleton />;
  }

  if (loadError) {
    return (
      <PageShell>
        <ErrorState
          variant="load"
          title="We could not load this project"
          detail={loadError}
          onRetry={load}
          href={`/projects/${projectId}`}
          hrefLabel="Back to the project"
        />
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <ErrorState
          variant="not-found"
          title="This project is no longer here"
          description="It may have been deleted since the link was made, or you may not have permission to edit it."
          href="/projects"
          hrefLabel="Back to projects"
        />
      </PageShell>
    );
  }

  const initialDataForForm = {
      ...data.project,
      // The column is a free string in the database; the shared schema allows
      // exactly two values. Narrowing here means the form cannot be seeded
      // with a currency it would then refuse to submit.
      currency: data.project.currency === 'USD' ? ('USD' as const) : ('ETB' as const),
      totalCost: data.project.totalCost ? parseFloat(data.project.totalCost) : 0,
      startDate: parseISO(data.project.startDate),
      endDate: parseISO(data.project.endDate),
      milestones: data.project.milestones.map((m: any) => ({
          ...m,
          cost: m.cost ? parseFloat(m.cost) : 0,
          startDate: parseISO(m.startDate),
          dueDate: parseISO(m.dueDate),
      })),
      payments: data.project.payments.map((p: any) => ({
        ...p,
        amount: p.amount ? parseFloat(p.amount) : 0,
        paymentDate: parseISO(p.paymentDate),
      }))
  };

  return (
    <PageShell className="mx-auto w-full max-w-6xl">
      <PageHeader
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: data.project.name, href: `/projects/${projectId}` },
          { label: 'Edit' },
        ]}
        title={`Edit ${data.project.name}`}
        description="Jump straight to the step you need — every step is already valid, so nothing has to be walked through in order."
      />
      <ProjectForm
        mode="edit"
        initialData={initialDataForForm}
        users={data.users}
        pmoDivisions={data.pmoDivisions}
        departments={data.departments}
        projectStatuses={data.projectStatuses}
        onSubmit={handleUpdateProject}
      />
    </PageShell>
  );
}
