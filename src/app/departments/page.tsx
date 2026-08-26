
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { DepartmentsManagement } from "@/components/departments/departments-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getDepartmentsData } from "./actions";
import type { Department } from '@prisma/client';
import type { Serialized } from '@/lib/serialize';
import { useFirstLoad } from "@/hooks/use-first-load";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading departments">
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
        </LoadingRegion>
    );
}

export default function DepartmentsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [departments, setDepartments] = useState<Serialized<Department>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getDepartmentsData();
            setDepartments(data);
        } catch (error) {
            // Was swallowed to an empty array, which is indistinguishable from
            // an organisation that has no departments.
            setLoadError(error instanceof Error ? error.message : "The request did not complete.");
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
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    return (
        <PageShell>
          <PageHeader
            title="Departments"
            description="The business departments projects are delivered for. Every project names at least one."
          />
          {loadError ? (
            <ErrorState
              variant="load"
              title="We could not load the departments"
              detail={loadError}
              onRetry={fetchData}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <DepartmentsManagement
                  initialDepartments={departments}
                  onDataChange={fetchData}
                />
              </CardContent>
            </Card>
          )}
        </PageShell>
    );
}
