'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { DepartmentManagement } from "@/components/departments/department-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getResponsibleDepartmentsData } from "./actions";
import type { Department, Project } from '@prisma/client';

export type DepartmentWithProjects = Department & {
    projects: Project[];
}

function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function ResponsibleDepartmentsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [departments, setDepartments] = useState<DepartmentWithProjects[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('responsible-depts:view')) {
                router.replace('/dashboard');
            } else {
                getResponsibleDepartmentsData().then(data => {
                    setDepartments(data);
                    setIsLoading(false);
                });
            }
        }
    }, [authLoading, hasPermission, router]);

    if (isLoading || authLoading) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="p-4 sm:p-6">
           <Card>
            <CardHeader>
              <CardTitle>Responsible Departments</CardTitle>
              <CardDescription>
                Manage departments and see which projects they are responsible for.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DepartmentManagement initialDepartments={departments} />
            </CardContent>
          </Card>
        </div>
    );
}