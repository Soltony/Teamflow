
'use client';

import { useAuth } from "@/context/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/config/user-management";
import { RoleManagement } from "@/components/config/role-management";
// UserWithRoles and Role come from lib/types: the shape the browser actually
// receives. Rebuilding them from the Prisma row declared a passwordHash on
// data the queries deliberately never select.
import type { Role, UserWithRoles } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";


type ConfigTabsProps = {
    users: UserWithRoles[];
    roles: Role[];
    pmoDivisions: { id: string; name: string }[];
    onDataChange: () => void;
};

export function ConfigTabs({ users, roles, pmoDivisions, onDataChange }: ConfigTabsProps) {
    const { hasPermission, loading } = useAuth();
    
    const canManageUsers = hasPermission('config:manage-users');
    const canManageRoles = hasPermission('config:manage-roles');

    // Determine default tab
    const defaultTab = canManageUsers ? "users" : canManageRoles ? "roles" : "";

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }
    
    if (!canManageUsers && !canManageRoles) {
        return null; // Or a message indicating no permissions
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
        </Tabs>
    );
}
