
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { InitiativesManagement } from "@/components/initiatives/initiatives-management";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getInitiativesData } from "./actions";
import type { Initiative } from '@prisma/client';
import type { Serialized } from '@/lib/serialize';
import { useFirstLoad } from "@/hooks/use-first-load";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading initiatives">
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

export default function InitiativesPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [initiatives, setInitiatives] = useState<Serialized<Initiative>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getInitiativesData();
            setInitiatives(data);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : "The request did not complete.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('initiatives:read')) {
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
            title="Initiatives"
            description="The strategic initiatives projects are delivered under. Projects choose from this list; they cannot add to it."
          />
          {loadError ? (
            <ErrorState
              variant="load"
              title="We could not load the initiatives"
              detail={loadError}
              onRetry={fetchData}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <InitiativesManagement
                  initialInitiatives={initiatives}
                  onDataChange={fetchData}
                />
              </CardContent>
            </Card>
          )}
        </PageShell>
    );
}
