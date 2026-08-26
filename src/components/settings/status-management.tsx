
"use client";

import { useState, useTransition } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ProjectStatus } from "@prisma/client";
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
import { createProjectStatus, updateProjectStatus, deleteProjectStatus } from "@/app/settings/actions";
import type { Serialized } from '@/lib/serialize';

const statusSchema = z.object({
  name: z.string().min(3, "Status name must be at least 3 characters."),
});

type StatusFormValues = z.infer<typeof statusSchema>;

type ProjectStatusManagementProps = {
  initialStatuses: Serialized<ProjectStatus>[];
  onDataChange: () => void;
};

export function ProjectStatusManagement({ initialStatuses, onDataChange }: ProjectStatusManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingStatus, setEditingStatus] = useState<Serialized<ProjectStatus> | null>(null);
  const [statusToDelete, setStatusToDelete] = useState<Serialized<ProjectStatus> | null>(null);

  const form = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { name: "" },
  });

  const isEditing = editingStatus !== null;

  function onSubmit(data: StatusFormValues) {
    startTransition(async () => {
      const result = isEditing
        ? await updateProjectStatus(editingStatus.id, data.name)
        : await createProjectStatus(data.name);

      if (result.success) {
        toast({
          title: isEditing ? "Status Updated!" : "Status Added!",
          description: `The "${data.name}" status has been successfully saved.`,
        });
        setEditingStatus(null);
        form.reset({ name: "" });
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleEdit(status: Serialized<ProjectStatus>) {
    setEditingStatus(status);
    form.reset({ name: status.name });
  }

  function handleCancelEdit() {
    setEditingStatus(null);
    form.reset({ name: "" });
  }

  function handleDeleteConfirm() {
    if (!statusToDelete) return;
    startTransition(async () => {
      const result = await deleteProjectStatus(statusToDelete.id);
      if (result.success) {
        toast({
          title: "Status Deleted",
          description: `The "${statusToDelete.name}" status has been removed.`,
        });
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
      setStatusToDelete(null);
    });
  }

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? "Edit Status" : "Add New Status"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Active" {...field} disabled={isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2 pt-2">
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update Status" : "Add Status")}
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
              <CardTitle>Existing Project Statuses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {initialStatuses.length === 0 && (
                <p className="text-muted-foreground">No statuses have been added yet.</p>
              )}
              {initialStatuses.map((status, index) => (
                <div key={status.id}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{status.name}</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(status)}>
                        <Pencil className="w-4 h-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setStatusToDelete(status)}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                  {index < initialStatuses.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!statusToDelete} onOpenChange={(open) => !open && setStatusToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              <span className="font-semibold">{statusToDelete?.name}</span> status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStatusToDelete(null)} disabled={isPending}>Cancel</AlertDialogCancel>
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
