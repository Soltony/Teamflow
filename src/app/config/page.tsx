
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigTabs } from "@/components/config/config-tabs";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getUsersData, getRolesData, getPmoDivisionsData } from "./actions";

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useFirstLoad } from "@/hooks/use-first-load";
import { ErrorState } from "@/components/ui/error-state";
import { PageShell } from "@/components/ui/page-header";

// Derived from the actions rather than restated here: the queries select a
// deliberately narrow set of columns, and the previous local definition
// claimed the whole user record including its password hash.

type ConfigData = {
    users: Awaited<ReturnType<typeof getUsersData>>;
    roles: Awaited<ReturnType<typeof getRolesData>>;
    pmoDivisions: Awaited<ReturnType<typeof getPmoDivisionsData>>;
};

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading configuration">
          <div className="p-4 sm:p-6 space-y-6">
              <Card>
                  <CardHeader>
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-4 w-96 mt-2" />
                  </CardHeader>
              </Card>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-96 w-full" />
          </div>
        </LoadingRegion>
    );
}

export default function ConfigPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<ConfigData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const canViewPage = hasPermission(['config:manage-users', 'config:manage-roles']);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const [usersData, rolesData, pmoDivisionsData] = await Promise.all([
                getUsersData(),
                getRolesData(),
                getPmoDivisionsData(),
            ]);
            setData({ users: usersData, roles: rolesData, pmoDivisions: pmoDivisionsData });
        } catch (error) {
            // Replacing the failure with empty arrays showed an administrator a
            // system with no users and no roles, which is alarming and untrue.
            setLoadError(error instanceof Error ? error.message : "The request did not complete.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!canViewPage) {
                router.replace('/dashboard');
            } else {
                fetchData();
            }
        }
    }, [authLoading, canViewPage, router, fetchData]);
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    if (loadError || !data) {
        return (
            <PageShell>
                <ErrorState
                    variant="load"
                    title="We could not load the configuration"
                    detail={loadError}
                    onRetry={fetchData}
                />
            </PageShell>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>
                        Manage application-wide settings, users, and roles from this central hub.
                    </CardDescription>
                </CardHeader>
            </Card>
            <ConfigTabs
                users={data.users}
                roles={data.roles}
                pmoDivisions={data.pmoDivisions}
                onDataChange={fetchData}
            />
        </div>
    );
}
