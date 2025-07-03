
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
import { PlusCircle, Pencil, Trash2, ChevronDown } from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem } from "../ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Badge } from "../ui/badge";
import { useAuth } from "@/context/auth-context";
import { availablePermissions } from "@/lib/permissions";

type RoleManagementProps = {
  initialRoles: Role[];
};

const roleSchema = z.object({
  name: z.string().min(3, "Role name must be at least 3 characters."),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export function RoleManagement({ initialRoles }: RoleManagementProps) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  
  const canCreate = hasPermission('config:manage-roles');
  const canUpdate = hasPermission('config:manage-roles');
  const canDelete = hasPermission('config:manage-roles');

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
            {canCreate && (
              <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Role
              </Button>
            )}
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
                                    {canUpdate && (
                                      <Button variant="ghost" size="icon" onClick={() => handleEdit(role)}>
                                          <Pencil className="w-4 h-4" />
                                          <span className="sr-only">Edit Role</span>
                                      </Button>
                                    )}
                                    {canDelete && (
                                      <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-destructive hover:text-destructive"
                                          onClick={() => setRoleToDelete(role)}
                                      >
                                          <Trash2 className="w-4 h-4" />
                                          <span className="sr-only">Delete Role</span>
                                      </Button>
                                    )}
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
        <DialogContent className="sm:max-w-2xl p-0 flex flex-col max-h-[90dvh]">
          <DialogHeader className="p-6 pb-4">
              <DialogTitle>{isEditing ? "Edit Role" : "Create New Role"}</DialogTitle>
              <DialogDescription>
                  {isEditing ? "Update the details for this role." : "Define a new role and its permissions."}
              </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <Form {...form}>
                <form id="role-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Permissions</FormLabel>
                          <FormDescription>
                            Select permissions for this role. Expand a section to see individual permissions.
                          </FormDescription>
                          <Accordion type="multiple" className="w-full space-y-2">
                            {Object.entries(availablePermissions).map(([groupName, permissions]) => {
                              const totalPermissionsInGroup = permissions.length;
                              const selectedPermissionsInGroup = permissions.filter(p => field.value?.includes(p)).length;
                              const allSelected = totalPermissionsInGroup > 0 && totalPermissionsInGroup === selectedPermissionsInGroup;

                              const handleGroupCheckedChange = (checked: boolean | string) => {
                                const currentPermissions = field.value || [];
                                let newPermissions;
                                if (checked) {
                                  newPermissions = [...new Set([...currentPermissions, ...permissions])];
                                } else {
                                  newPermissions = currentPermissions.filter(p => !permissions.includes(p));
                                }
                                field.onChange(newPermissions);
                              };

                              return (
                                <AccordionItem value={groupName} key={groupName} className="border rounded-lg data-[state=open]:shadow-md">
                                  <AccordionPrimitive.Header className="flex w-full items-center justify-between px-4 py-2">
                                    <div className="flex items-center gap-3">
                                      <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={handleGroupCheckedChange}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span className="font-semibold text-base">{groupName}</span>
                                    </div>
                                    <AccordionPrimitive.Trigger className="flex items-center gap-2 p-0">
                                      <Badge variant="secondary">{`${selectedPermissionsInGroup}/${totalPermissionsInGroup}`}</Badge>
                                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                    </AccordionPrimitive.Trigger>
                                  </AccordionPrimitive.Header>
                                  <AccordionContent className="p-4 border-t">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {permissions.map((permission) => (
                                        <FormItem
                                          key={permission}
                                          className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 bg-background hover:bg-muted/50 transition-colors"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(permission)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), permission])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== permission
                                                      )
                                                    );
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal text-sm leading-none cursor-pointer w-full">
                                            {permission.split(':')[1].replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                          </FormLabel>
                                        </FormItem>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </form>
            </Form>
          </div>
          <DialogFooter className="p-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isPending}>Cancel</Button>
              <Button type="submit" form="role-form" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Role"}
              </Button>
          </DialogFooter>
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
