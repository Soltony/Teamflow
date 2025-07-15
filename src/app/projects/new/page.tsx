
'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNewProjectData, createProject } from "../actions";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Department, ProjectStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

type NewProjectData = {
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

export default function NewProjectPage() {
  const { hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<NewProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('projects:create')) {
        router.replace('/dashboard');
      } else {
        getNewProjectData().then(fetchedData => {
          setData(fetchedData);
          setLoading(false);
        });
      }
    }
  }, [authLoading, hasPermission, router]);

  const handleCreateProject = async (formData: any) => {
    try {
      const dataToSend = {
        ...formData,
        totalCost: formData.hasCost ? new Decimal(formData.totalCost || 0) : null,
        milestones: formData.milestones.map((m: any) => ({
          ...m,
          cost: formData.hasCost && formData.costByMilestones ? new Decimal(m.cost || 0) : null,
        })),
      };
      
      await createProject(dataToSend);
      toast({
        title: "Project Created!",
        description: `Project "${formData.name}" has been successfully created.`,
      });
      router.push('/dashboard');
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (loading || authLoading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6">
        <p>Could not load project creation form. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Create a New Project</CardTitle>
          <CardDescription>
            Fill in the project details, assign it to a department, and define the major milestones.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ProjectForm
            mode="create"
            users={data.users}
            departments={data.departments}
            projectStatuses={data.projectStatuses}
            onSubmit={handleCreateProject}
          />
        </CardContent>
      </Card>
    </div>
  );
}

    