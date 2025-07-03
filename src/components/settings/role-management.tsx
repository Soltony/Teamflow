
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Role } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createRole, updateRole, deleteRole } from "@/app/settings/actions";

const roleSchema = z.object({
  name: z.string().min(3, "Role name must be at least 3 characters."),
  description: z.string().optional(),
  permissions: z.string().optional(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export function RoleManagement({ initialRoles }: { initialRoles: Role[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: "",
    },
  });

  const isEditing = editingRole !== null;

  useEffect(() => {
    if (isDialogOpen) {
      if (editingRole) {
        form.reset({
          name: editingRole.name,
          description: editingRole.description || "",
          permissions: editingRole.permissions.join("\n"),
        });
      } else {
        form.reset({ name: "", description: "", permissions: "" });
      }
    }
  }, [isDialogOpen, editingRole, form]);

  function onSubmit(data: RoleFormValues) {
    startTransition(async () => {
      const permissionsArray = data.permissions ? data.permissions.split('\n').filter(p => p.trim() !== '') : [];
      const roleData = { ...data, permissions: permissionsArray };

      const result = isEditing
        ? await updateRole(editingRole!.id, roleData)
        : await createRole(roleData);

      if (result.success) {
        toast({
          title: isEditing ? "Role Updated!" : "Role Created!",
          description: `The "${data.name}" role has been successfully saved.`,
        });
        setIsDialogOpen(false);
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
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

  const handleAddNew = () => {
    setEditingRole(null);
    setIsDialogOpen(true);
  };
  
  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setIsDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Define roles and their permissions within the application.</CardDescription>
          </div>
           <Button onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Add Role</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {initialRoles.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No roles have been created yet.</p>
            ) : (
              initialRoles.map((role, index) => (
                <div key={role.id}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold">{role.name}</h3>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                      {role.permissions.length > 0 && (
                        <div className="mt-2 text-xs">
                          <span className="font-medium">Permissions:</span>
                          <span className="text-muted-foreground ml-1">{role.permissions.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(role)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setRoleToDelete(role)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {index < initialRoles.length - 1 && <Separator className="my-4" />}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Role" : "Create New Role"}</DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Update the details for this role."
                    : "Define a new role and its permissions."}
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
                                <Input placeholder="e.g., Project Manager" {...field} disabled={isPending} />
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
                                <Input placeholder="Briefly describe this role's purpose" {...field} disabled={isPending} />
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
                                <Textarea placeholder="Enter one permission per line, e.g., create:project" {...field} disabled={isPending} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Role" : "Create Role")}
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
