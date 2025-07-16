
'use client';

import { useAuth } from "@/context/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/config/user-management";
import { RoleManagement } from "@/components/config/role-management";
import type { Role, User, PmoDivision } from "@prisma/client";
import { Card, CardContent } from "../ui/card";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "../ui/skeleton";

type UserWithRoles = User & { roles: Role[] };

type ConfigTabsProps = {
    users: UserWithRoles[];
    roles: Role[];
    pmoDivisions: PmoDivision[];
};

export function ConfigTabs({ users, roles, pmoDivisions }: ConfigTabsProps) {
    const { hasPermission, loading } = useAuth();
    const router = useRouter();
    
    const canManageUsers = hasPermission('config:manage-users');
    const canManageRoles = hasPermission('config:manage-roles');

    useEffect(() => {
        if (!loading && !canManageUsers && !canManageRoles) {
            router.replace('/dashboard');
        }
    }, [loading, canManageUsers, canManageRoles, router]);
    
    // Determine default tab
    const defaultTab = canManageUsers ? "users" : canManageRoles ? "roles" : "";

    if (loading || (!canManageUsers && !canManageRoles)) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }
    
    const gridCols = [canManageUsers, canManageRoles].filter(Boolean).length;

    return (
        <Tabs defaultValue={defaultTab}>
            <TabsList className={`grid w-full grid-cols-${gridCols}`}>
                {canManageUsers && <TabsTrigger value="users">User Management</TabsTrigger>}
                {canManageRoles && <TabsTrigger value="roles">Role Management</TabsTrigger>}
            </TabsList>
            {canManageUsers && (
                <TabsContent value="users" className="mt-6">
                    <UserManagement 
                        initialUsers={users} 
                        initialRoles={roles}
                        initialPmoDivisions={pmoDivisions}
                    />
                </TabsContent>
            )}
            {canManageRoles && (
                <TabsContent value="roles" className="mt-6">
                    <RoleManagement 
                        initialRoles={roles}
                    />
                </TabsContent>
            )}
        </Tabs>
    );
}
