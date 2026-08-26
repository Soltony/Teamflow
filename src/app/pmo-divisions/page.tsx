
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PmoDivisionManagement } from "@/components/pmo-divisions/pmo-division-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getPmoDivisionsData } from "./actions";
import type { PmoDivision } from '@prisma/client';
import type { Serialized } from '@/lib/serialize';
import { useFirstLoad } from "@/hooks/use-first-load";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading epmo divisions">
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

export default function PmoDivisionsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pmoDivisions, setPmoDivisions] = useState<Serialized<PmoDivision>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getPmoDivisionsData();
            setPmoDivisions(data);
        } catch (error) {
            // Was swallowed to an empty array, which reads as "there are no
            // divisions" rather than "we could not ask".
            setLoadError(error instanceof Error ? error.message : "The request did not complete.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('pmo-divisions:view')) {
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
                title="EPMO divisions"
                description="The divisions that own and run projects."
              />
              <ErrorState
                variant="load"
                title="We could not load the EPMO divisions"
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
              <CardTitle>EPMO Division Management</CardTitle>
              <CardDescription>
                Add, view, and manage the EPMO divisions that are responsible for managing projects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PmoDivisionManagement
                initialPmoDivisions={pmoDivisions}
                onDataChange={fetchData}
              />
            </CardContent>
          </Card>
        </div>
    );
}
