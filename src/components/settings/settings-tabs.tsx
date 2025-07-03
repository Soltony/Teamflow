
'use client';

import type { ProjectStatus } from "@prisma/client";
import { useAuth } from "@/context/auth-context";
import { ActiveYearManagement } from "./active-year-management";
import { ProjectStatusManagement } from "./status-management";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Card, CardContent } from "../ui/card";

type SettingsTabsProps = {
    projectStatuses: ProjectStatus[];
    availableYears: string[];
    currentActiveYear: string;
}

export function SettingsTabs({ projectStatuses, availableYears, currentActiveYear }: SettingsTabsProps) {
    const { hasPermission } = useAuth();
    const canManageSettings = hasPermission('settings:manage');

    if (!canManageSettings) {
        return (
            <Card>
                <CardContent className="p-6">
                    <p>You do not have permission to manage settings.</p>
                </CardContent>
            </Card>
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
