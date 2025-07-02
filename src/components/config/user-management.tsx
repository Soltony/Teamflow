
"use client";

<<<<<<< HEAD
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
=======
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Checkbox } from "../ui/checkbox";
import type { Role, User } from "@prisma/client";
import { assignRolesToUser } from "@/app/config/actions";
import { Badge } from "../ui/badge";

type UserWithRoles = User & { roles: Role[] };

type UserManagementProps = {
  initialUsers: UserWithRoles[];
  initialRoles: Role[];
};

const assignRolesSchema = z.object({
    roleIds: z.array(z.string()).refine((value) => value.some((item) => item), {
        message: "You have to select at least one role.",
    }),
});

type AssignRolesFormValues = z.infer<typeof assignRolesSchema>;

export function UserManagement({ initialUsers, initialRoles }: UserManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);

  const form = useForm<AssignRolesFormValues>({
    resolver: zodResolver(assignRolesSchema),
    defaultValues: {
      roleIds: [],
    },
  });

  const handleEdit = (user: UserWithRoles) => {
    setEditingUser(user);
    form.reset({
      roleIds: user.roles.map(role => role.id),
    });
  };

  const handleCloseDialog = () => {
    setEditingUser(null);
    form.reset({ roleIds: [] });
  };

  function onSubmit(data: AssignRolesFormValues) {
    if (!editingUser) return;
    startTransition(async () => {
        const result = await assignRolesToUser(editingUser.id, data.roleIds);
        if (result.success) {
            toast({
                title: "Roles Updated",
                description: `Successfully updated roles for ${editingUser.name}.`,
            });
            handleCloseDialog();
        } else {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive"
            });
        }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            A list of all users in the system. Assign roles to manage their permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {user.roles.map(role => (
                            <Badge key={role.id} variant="secondary">{role.name}</Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit Roles</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Roles for {editingUser?.name}</DialogTitle>
                <DialogDescription>
                    Select the roles to be assigned to this user.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField
                        control={form.control}
                        name="roleIds"
                        render={() => (
                            <FormItem>
                            {initialRoles.map((role) => (
                                <FormField
                                key={role.id}
                                control={form.control}
                                name="roleIds"
                                render={({ field }) => {
                                    return (
                                    <FormItem
                                        key={role.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(role.id)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...(field.value || []), role.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                    (value) => value !== role.id
                                                    )
                                                )
                                            }}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                            {role.name}
                                        </FormLabel>
                                    </FormItem>
                                    )
                                }}
                                />
                            ))}
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                     <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isPending}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Saving..." : "Save Roles"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </>
  );
>>>>>>> d1997e7eced32ba05aee3b3f4b5b652fab47b1f8
}
