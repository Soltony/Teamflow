
"use client";

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
import { createRole, updateRole, deleteRole } from "@/app/config/actions";
import { Textarea } from "../ui/textarea";

const roleSchema = z.object({
  name: z.string().min(3, "Role name must be at least 3 characters."),
  description: z.string().optional(),
  permissions: z.string().min(1, "At least one permission is required."),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export function RoleManagement({ initialRoles }: { initialRoles: Role[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
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
