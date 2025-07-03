
'use client';

import { useAuth } from "@/context/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/config/user-management";
import { RoleManagement } from "@/components/config/role-management";
import type { Role, User } from "@prisma/client";
import { Card, CardContent } from "../ui/card";

type UserWithRoles = User & { roles: Role[] };

type ConfigTabsProps = {
    users: UserWithRoles[];
    roles: Role[];
};

export function ConfigTabs({ users, roles }: ConfigTabsProps) {
    const { hasPermission } = useAuth();
    
    const canManageUsers = hasPermission('config:manage-users');
    const canManageRoles = hasPermission('config:manage-roles');
    
    // Determine default tab
    const defaultTab = canManageUsers ? "users" : canManageRoles ? "roles" : "";

    if (!canManageUsers && !canManageRoles) {
        return (
            <Card>
                <CardContent className="p-6">
                    <p>You do not have permission to view this page.</p>
                </CardContent>
            </Card>
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
