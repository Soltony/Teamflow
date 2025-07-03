
'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNewProjectData } from "../actions";
import { useAuth } from "@/context/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Department, ProjectStatus } from "@prisma/client";

type NewProjectData = {
  users: User[];
  departments: Department[];
  projectStatuses: ProjectStatus[];
  activeYear: string;
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
        <CardContent>
            <ProjectForm 
              users={data.users}
              departments={data.departments}
              projectStatuses={data.projectStatuses}
              activeYear={data.activeYear}
            />
        </CardContent>
      </Card>
    </div>
  );
}
