
"use client";

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
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Role } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import { createRole, deleteRole, updateRole } from "@/app/config/actions";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";

type RoleManagementProps = {
  initialRoles: Role[];
};

const availablePermissions: Record<string, string[]> = {
    'Dashboard': ['dashboard:view'],
    'My Tasks': ['my-tasks:view'],
    'Team View': ['team-view:view', 'team-view:manage'],
    'Projects': ['projects:create', 'projects:read', 'projects:update', 'projects:delete'],
    'Milestones': ['milestones:view'],
    'Gantt': ['gantt:view'],
    'Departments': ['departments:create', 'departments:read', 'departments:update', 'departments:delete'],
    'Teams': ['teams:create', 'teams:read', 'teams:update', 'teams:delete'],
    'Settings': ['settings:manage'],
    'Configuration': ['config:manage-users', 'config:manage-roles'],
};


const roleSchema = z.object({
  name: z.string().min(3, "Role name must be at least 3 characters."),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export function RoleManagement({ initialRoles }: RoleManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
  });

  const isEditing = editingRole !== null;

  const handleAddNew = () => {
    setEditingRole(null);
    form.reset({ name: "", description: "", permissions: [] });
    setIsDialogOpen(true);
  };
  
  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.reset({
        name: role.name,
        description: role.description || "",
        permissions: role.permissions,
    });
    setIsDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setEditingRole(null);
    setIsDialogOpen(false);
  }

  const handleDeleteConfirm = () => {
    if (!roleToDelete) return;

    startTransition(async () => {
      const result = await deleteRole(roleToDelete.id);
      if (result.success) {
        toast({
          title: "Role Deleted",
          description: `The "${roleToDelete.name}" role has been removed.`,
        });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
      setRoleToDelete(null);
    });
  };

  const onSubmit = (data: RoleFormValues) => {
    const submissionData = { ...data, permissions: data.permissions || [] };

    startTransition(async () => {
      const result = isEditing && editingRole
        ? await updateRole(editingRole.id, submissionData)
        : await createRole(submissionData);

      if (result.success) {
        toast({
          title: isEditing ? "Role Updated!" : "Role Created!",
          description: `The "${data.name}" role has been successfully saved.`,
        });
        handleCloseDialog();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Roles</CardTitle>
              <CardDescription>
                Define roles to control user access and permissions across the application.
              </CardDescription>
            </div>
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            {initialRoles.length > 0 ? (
                <div className="space-y-4">
                    {initialRoles.map((role, index) => (
                        <div key={role.id}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-lg">{role.name}</h3>
                                    <p className="text-muted-foreground">{role.description}</p>
                                    <div className="mt-2 text-sm text-muted-foreground">
                                        <span className="font-medium">Permissions:</span> {role.permissions.join(", ") || "None"}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(role)}>
                                        <Pencil className="w-4 h-4" />
                                        <span className="sr-only">Edit Role</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => setRoleToDelete(role)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span className="sr-only">Delete Role</span>
                                    </Button>
                                </div>
                            </div>
                            {index < initialRoles.length - 1 && <Separator className="my-4" />}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-8">No roles have been created yet.</p>
            )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Role" : "Create New Role"}</DialogTitle>
                <DialogDescription>
                    {isEditing ? "Update the details for this role." : "Define a new role and its permissions."}
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Role Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Project Manager" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Describe what this role can do." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="permissions"
                        render={() => (
                            <FormItem>
                            <FormLabel>Permissions</FormLabel>
                            <FormDescription>Select the permissions for this role.</FormDescription>
                            <ScrollArea className="h-72 w-full rounded-md border p-4">
                                <div className="space-y-4">
                                    {Object.entries(availablePermissions).map(([groupName, permissions]) => (
                                    <div key={groupName}>
                                        <h4 className="font-medium text-sm mb-2">{groupName}</h4>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-2">
                                        {permissions.map((permission) => (
                                            <FormField
                                            key={permission}
                                            control={form.control}
                                            name="permissions"
                                            render={({ field }) => {
                                                return (
                                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                    <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(permission)}
                                                        onCheckedChange={(checked) => {
                                                        return checked
                                                            ? field.onChange([...(field.value || []), permission])
                                                            : field.onChange(
                                                                field.value?.filter((value) => value !== permission)
                                                            );
                                                        }}
                                                    />
                                                    </FormControl>
                                                    <FormLabel className="font-normal text-sm">{permission.split(':')[1]}</FormLabel>
                                                </FormItem>
                                                );
                                            }}
                                            />
                                        ))}
                                        </div>
                                    </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isPending}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Saving..." : "Save Role"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              <span className="font-semibold">{roleToDelete?.name}</span> role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
