
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigTabs } from "@/components/config/config-tabs";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getUsersData, getRolesData, getPmoDivisionsData } from "./actions";

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useFirstLoad } from "@/hooks/use-first-load";

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

    const canViewPage = hasPermission(['config:manage-users', 'config:manage-roles']);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersData, rolesData, pmoDivisionsData] = await Promise.all([
                getUsersData(),
                getRolesData(),
                getPmoDivisionsData(),
            ]);
            setData({ users: usersData, roles: rolesData, pmoDivisions: pmoDivisionsData });
        } catch (error) {
            console.error("Failed to fetch config data", error);
            setData({ users: [], roles: [], pmoDivisions: [] });
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

    if (!data) {
        return (
            <div className="p-4 sm:p-6 text-center">
                Could not load configuration data. Please try again later.
            </div>
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
