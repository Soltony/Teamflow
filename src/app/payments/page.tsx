
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PaymentsManagement } from "@/components/payments/payments-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getPaymentsPageData } from "./actions";
import type { Project } from '@prisma/client';
import type { Serialized } from '@/lib/serialize';
import { useFirstLoad } from "@/hooks/use-first-load";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading payments">
          <div className="p-4 sm:p-6 space-y-6">
              <Card>
                  <CardHeader>
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-4 w-96 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                  </CardContent>
              </Card>
          </div>
        </LoadingRegion>
    );
}

export default function PaymentsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Serialized<Project>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getPaymentsPageData();
            setProjects(data);
        } catch (error) {
            // Money screens especially must not fail silently: an empty list
            // here previously meant either "nothing to pay" or "we could not
            // ask", with nothing on screen to tell them apart.
            setLoadError(error instanceof Error ? error.message : "The request did not complete.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('payments:view')) {
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

    if (loadError) {
        return (
            <PageShell>
              <PageHeader
                title="Payments"
                description="Payments recorded against projects."
              />
              <ErrorState
                variant="load"
                title="We could not load the payments"
                detail={loadError}
                onRetry={fetchData}
              />
            </PageShell>
        );
    }

    return (
        <div className="p-4 sm:p-6">
           <Card>
            <CardHeader>
              <CardTitle>Project Payments</CardTitle>
              <CardDescription>
                Record and track payments made against projects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentsManagement
                initialProjects={projects}
                onDataChange={fetchData}
              />
            </CardContent>
          </Card>
        </div>
    );
}
