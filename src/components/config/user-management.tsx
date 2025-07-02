
"use client";

import { useState } from "react";
import type { User, Role } from "@prisma/client";
import { UserRoleDialog } from "./user-role-dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

type UserWithRoles = User & {
    roles: Role[];
};

type UserManagementProps = {
    initialUsers: UserWithRoles[];
    allRoles: Role[];
};

export function UserManagement({ initialUsers, allRoles }: UserManagementProps) {
    const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);

    return (
        <>
            <div className="space-y-4">
                {initialUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src={user.avatar || undefined} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                                {user.roles.length > 0 ? (
                                    user.roles.map(role => (
                                        <Badge key={role.id} variant="secondary">{role.name}</Badge>
                                    ))
                                ) : (
                                    <Badge variant="outline">No Roles</Badge>
                                )}
                            </div>
                            <Button variant="outline" onClick={() => setSelectedUser(user)}>Manage Roles</Button>
                        </div>
                    </div>
                ))}
            </div>

            {selectedUser && (
                <UserRoleDialog
                    isOpen={!!selectedUser}
                    onOpenChange={() => setSelectedUser(null)}
                    user={selectedUser}
                    allRoles={allRoles}
                />
            )}
        </>
    );
}
