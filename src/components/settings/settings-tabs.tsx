
'use client';

import type { ProjectStatus } from "@prisma/client";
import { useAuth } from "@/context/auth-context";
import { ActiveYearManagement } from "./active-year-management";
import { ProjectStatusManagement } from "./status-management";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Skeleton } from "../ui/skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type SettingsTabsProps = {
    projectStatuses: ProjectStatus[];
    availableYears: string[];
    currentActiveYear: string;
}

export function SettingsTabs({ projectStatuses, availableYears, currentActiveYear }: SettingsTabsProps) {
    const { hasPermission, loading } = useAuth();
    const router = useRouter();
    const canManageSettings = hasPermission('settings:manage');

    useEffect(() => {
        if (!loading && !canManageSettings) {
            router.replace('/dashboard');
        }
    }, [loading, canManageSettings, router]);

    if (loading || !canManageSettings) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
         <Tabs defaultValue="statuses" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="statuses">Project Statuses</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            </TabsList>
            <TabsContent value="statuses" className="mt-6">
            <ProjectStatusManagement 
                initialStatuses={projectStatuses}
            />
            </TabsContent>
            <TabsContent value="general" className="mt-6">
            <ActiveYearManagement
                availableYears={availableYears}
                currentActiveYear={currentActiveYear}
            />
            </TabsContent>
      </Tabs>
    );
}
