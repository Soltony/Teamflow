
'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ProjectForm } from "@/components/projects/project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectForEdit, updateProject } from "../../actions";
import type { User, Department, ProjectStatus } from "@prisma/client";
import { parseISO } from "date-fns";

type EditProjectData = {
  project: any;
  users: User[];
  departments: Department[];
  projectStatuses: ProjectStatus[];
};

function LoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
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

  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('projects:update')) {
        router.replace('/dashboard');
      } else {
        getProjectForEdit(projectId).then(fetchedData => {
          if (fetchedData) {
            setData(fetchedData);
          } else {
             router.replace('/projects');
          }
          setLoading(false);
        });
      }
    }
  }, [authLoading, hasPermission, router, projectId]);

  const handleUpdateProject = async (formData: any) => {
    // The conversion to Decimal will happen on the server side in the action.
    // The form data can send numbers.
    const result = await updateProject(projectId, formData);
    if (result.success) {
      toast({
        title: "Project Updated!",
        description: `Project "${formData.name}" has been successfully updated.`,
      });
      router.push(`/projects/${projectId}`);
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update project. Please try again.",
        variant: "destructive",
      });
    }
    return result;
  };
  
  if (loading || authLoading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6">
        <p>Could not load project data. It may have been deleted or you don't have permission to view it.</p>
      </div>
    );
  }
  
  const initialDataForForm = {
      ...data.project,
      totalCost: data.project.totalCost ? parseFloat(data.project.totalCost) : 0,
      startDate: parseISO(data.project.startDate),
      endDate: parseISO(data.project.endDate),
      milestones: data.project.milestones.map((m: any) => ({
          ...m,
          cost: m.cost ? parseFloat(m.cost) : 0,
          startDate: parseISO(m.startDate),
          dueDate: parseISO(m.dueDate),
      }))
  };

  return (
    <div className="p-4 sm:p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Edit Project: {data.project.name}</CardTitle>
          <CardDescription>
            Update the project details and milestones below.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ProjectForm
            mode="edit"
            initialData={initialDataForForm}
            users={data.users}
            departments={data.departments}
            projectStatuses={data.projectStatuses}
            onSubmit={handleUpdateProject}
          />
        </CardContent>
      </Card>
    </div>
  );
}
