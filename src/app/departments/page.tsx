
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { DepartmentsManagement } from "@/components/departments/departments-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDepartmentsData } from "./actions";
import type { Department } from '@prisma/client';

function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <Skeleton className="h-64 w-full" />
                        </div>
                        <div className="md:col-span-2">
                             <Skeleton className="h-64 w-full" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function DepartmentsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getDepartmentsData();
            setDepartments(data);
        } catch (error) {
            console.error("Failed to fetch departments", error);
            setDepartments([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('departments:read')) {
                router.replace('/dashboard');
            } else {
                fetchData();
            }
        }
    }, [authLoading, hasPermission, router, fetchData]);

    if (isLoading || authLoading) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="p-4 sm:p-6">
           <Card>
            <CardHeader>
              <CardTitle>Department Management</CardTitle>
              <CardDescription>
                Add, view, and manage the departments within the organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DepartmentsManagement 
                initialDepartments={departments} 
                onDataChange={fetchData} 
              />
            </CardContent>
          </Card>
        </div>
    );
}
