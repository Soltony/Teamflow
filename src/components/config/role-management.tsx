
"use client";

<<<<<<< HEAD
import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Role } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Role } from "@prisma/client";
>>>>>>> d1997e7eced32ba05aee3b3f4b5b652fab47b1f8
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
<<<<<<< HEAD
import { createRole, updateRole, deleteRole } from "@/app/config/actions";
import { Textarea } from "../ui/textarea";
=======
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import { createRole, deleteRole, updateRole } from "@/app/config/actions";

type RoleManagementProps = {
  initialRoles: Role[];
};
>>>>>>> d1997e7eced32ba05aee3b3f4b5b652fab47b1f8

const roleSchema = z.object({
  name: z.string().min(3, "Role name must be at least 3 characters."),
  description: z.string().optional(),
<<<<<<< HEAD
  permissions: z.string().min(1, "At least one permission is required."),
=======
  permissions: z.string().optional(),
>>>>>>> d1997e7eced32ba05aee3b3f4b5b652fab47b1f8
});

type RoleFormValues = z.infer<typeof roleSchema>;

<<<<<<< HEAD
export function RoleManagement({ initialRoles }: { initialRoles: Role[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
=======
export function RoleManagement({ initialRoles }: RoleManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
>>>>>>> d1997e7eced32ba05aee3b3f4b5b652fab47b1f8
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
<<<<<<< HEAD
    defaultValues: { name: "", description: "", permissions: "" },
  });
  
  const isEditing = editingRole !== null;

  useEffect(() => {
    if (editingRole) {
        form.reset({
            name: editingRole.name,
            description: editingRole.description || "",
            permissions: editingRole.permissions.join(', '),
        });
    } else {
        form.reset({ name: "", description: "", permissions: "" });
    }
  }, [editingRole, form]);


  function onSubmit(data: RoleFormValues) {
    const permissionsArray = data.permissions.split(',').map(p => p.trim()).filter(Boolean);
    const roleData = { ...data, permissions: permissionsArray };

    startTransition(async () => {
      const result = isEditing
        ? await updateRole(editingRole.id, roleData)
        : await createRole(roleData);

      if (result.success) {
        toast({
          title: isEditing ? "Role Updated!" : "Role Added!",
          description: `The "${data.name}" role has been successfully saved.`,
        });
        setEditingRole(null);
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleCancelEdit() {
    setEditingRole(null);
  }

  function handleDeleteConfirm() {
    if (!roleToDelete) return;
=======
  });

  const isEditing = editingRole !== null;

  const handleAddNew = () => {
    setEditingRole(null);
    form.reset({ name: "", description: "", permissions: "" });
    setIsDialogOpen(true);
  };
  
  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.reset({
        name: role.name,
        description: role.description || "",
        permissions: role.permissions.join(", "),
    });
    setIsDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setEditingRole(null);
    setIsDialogOpen(false);
  }

  const handleDeleteConfirm = () => {
    if (!roleToDelete) return;

>>>>>>> d1997e7eced32ba05aee3b3f4b5b652fab47b1f8
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
<<<<<<< HEAD
  }

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? "Edit Role" : "Add New Role"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Administrator" {...field} disabled={isPending} />
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
                          <Textarea placeholder="Describe what this role can do." {...field} disabled={isPending} />
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
                        <FormControl>
                          <Input placeholder="e.g., manage:users, view:reports" {...field} disabled={isPending} />
                        </FormControl>
                        <FormDescription>
                          Enter permissions separated by commas.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2 pt-2">
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update Role" : "Add Role")}
                    </Button>
                    {isEditing && (
                      <Button type="button" variant="outline" className="w-full" onClick={handleCancelEdit} disabled={isPending}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Existing Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {initialRoles.length === 0 && (
                <p className="text-muted-foreground">No roles have been added yet.</p>
              )}
              {initialRoles.map((role, index) => (
                <div key={role.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{role.name}</h3>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Permissions: {role.permissions.join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingRole(role)}>
                        <Pencil className="w-4 h-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRoleToDelete(role)}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                  {index < initialRoles.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

=======
  };

  const onSubmit = (data: RoleFormValues) => {
    const permissionsArray = data.permissions ? data.permissions.split(",").map(p => p.trim()).filter(Boolean) : [];
    const submissionData = { ...data, permissions: permissionsArray };

    startTransition(async () => {
      const result = isEditing
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
        <DialogContent>
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
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Permissions</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="e.g., manage_billing, view_reports" {...field} />
                                </FormControl>
                                <FormDescription>
                                    Enter a comma-separated list of permissions.
                                </FormDescription>
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
      
>>>>>>> d1997e7eced32ba05aee3b3f4b5b652fab47b1f8
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
