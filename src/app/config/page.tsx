
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigTabs } from "@/components/config/config-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getUsersData, getRolesData, getPmoDivisionsData } from "./actions";
import type { Role, User, PmoDivision } from "@prisma/client";
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

type UserWithRoles = User & { roles: Role[] };

type ConfigData = {
    users: UserWithRoles[];
    roles: Role[];
    pmoDivisions: PmoDivision[];
};

function LoadingSkeleton() {
    return (
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

    if (isLoading || authLoading) {
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
