
'use client';

import type { ProjectStatus, Role, User, PmoDivision } from "@prisma/client";
import { useAuth } from "@/context/auth-context";
import { ActiveYearManagement } from "./active-year-management";
import { ProjectStatusManagement } from "./status-management";
import { UserManagement } from "./user-management";
import { RoleManagement } from "./role-management";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Skeleton } from "../ui/skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type UserWithRoles = User & { roles: Role[] };

type SettingsTabsProps = {
    projectStatuses: ProjectStatus[];
    availableYears: string[];
    currentActiveYear: string;
    users: UserWithRoles[];
    roles: Role[];
    pmoDivisions: PmoDivision[];
    onDataChange: () => void;
}

export function SettingsTabs({ 
    projectStatuses, 
    availableYears, 
    currentActiveYear, 
    users, 
    roles, 
    pmoDivisions,
    onDataChange 
}: SettingsTabsProps) {
    const { hasPermission, loading } = useAuth();
    const router = useRouter();

    const canManageSettings = hasPermission('settings:manage');
    const canManageUsers = hasPermission('config:manage-users');
    const canManageRoles = hasPermission('config:manage-roles');

    const visibleTabs = [
        canManageUsers && 'users',
        canManageRoles && 'roles',
        canManageSettings && 'statuses',
        canManageSettings && 'general'
    ].filter(Boolean) as string[];

    const defaultTab = visibleTabs[0] || "";

    const gridColsClass = `grid-cols-${visibleTabs.length}`;

    useEffect(() => {
        if (!loading && !canManageSettings && !canManageUsers && !canManageRoles) {
            router.replace('/dashboard');
        }
    }, [loading, canManageSettings, canManageUsers, canManageRoles, router]);

    if (loading || visibleTabs.length === 0) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
         <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className={cn("grid w-full", `grid-cols-${visibleTabs.length}`)}>
                {canManageUsers && <TabsTrigger value="users">Users</TabsTrigger>}
                {canManageRoles && <TabsTrigger value="roles">Roles</TabsTrigger>}
                {canManageSettings && <TabsTrigger value="statuses">Project Statuses</TabsTrigger>}
                {canManageSettings && <TabsTrigger value="general">General</TabsTrigger>}
            </TabsList>
            
            {canManageUsers && (
                <TabsContent value="users" className="mt-6">
                    <UserManagement 
                        initialUsers={users} 
                        initialRoles={roles}
                        initialPmoDivisions={pmoDivisions}
                        onDataChange={onDataChange}
                    />
                </TabsContent>
            )}
            
            {canManageRoles && (
                 <TabsContent value="roles" className="mt-6">
                    <RoleManagement 
                        initialRoles={roles}
                        onDataChange={onDataChange}
                    />
                </TabsContent>
            )}

            {canManageSettings && (
                <TabsContent value="statuses" className="mt-6">
                    <ProjectStatusManagement 
                        initialStatuses={projectStatuses}
                        onDataChange={onDataChange}
                    />
                </TabsContent>
            )}

            {canManageSettings && (
                <TabsContent value="general" className="mt-6">
                    <ActiveYearManagement
                        availableYears={availableYears}
                        currentActiveYear={currentActiveYear}
                        onDataChange={onDataChange}
                    />
                </TabsContent>
            )}
      </Tabs>
    );
}
