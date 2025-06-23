"use client";

import { useState } from "react";
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
import { projectStatuses as initialStatuses } from "@/lib/data";
import type { ProjectStatus } from "@/lib/types";
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

const statusSchema = z.object({
  name: z.string().min(3, "Status name must be at least 3 characters."),
});

type StatusFormValues = z.infer<typeof statusSchema>;

export function ProjectStatusManagement() {
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<ProjectStatus[]>(initialStatuses);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [statusToDelete, setStatusToDelete] = useState<ProjectStatus | null>(null);

  const form = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      name: "",
    },
  });

  const isEditing = editingStatusId !== null;

  function onSubmit(data: StatusFormValues) {
    if (isEditing) {
      setStatuses(
        statuses.map((status) =>
          status.id === editingStatusId
            ? { ...status, name: data.name }
            : status
        )
      );
      toast({
        title: "Status Updated!",
        description: `The "${data.name}" status has been successfully updated.`,
      });
      setEditingStatusId(null);
    } else {
      const newStatus: ProjectStatus = {
        id: `status-${Date.now()}`,
        name: data.name,
      };
      setStatuses([...statuses, newStatus]);
      toast({
        title: "Status Added!",
        description: `The "${data.name}" status has been successfully created.`,
      });
    }
    form.reset({ name: "" });
  }

  function handleEdit(status: ProjectStatus) {
    setEditingStatusId(status.id);
    form.reset({ name: status.name });
  }

  function handleCancelEdit() {
    setEditingStatusId(null);
    form.reset({ name: "" });
  }

  function handleDeleteConfirm() {
    if (!statusToDelete) return;
    setStatuses(statuses.filter((status) => status.id !== statusToDelete.id));
    toast({
      title: "Status Deleted",
      description: `The "${statusToDelete.name}" status has been removed.`,
      variant: "destructive",
    });
    setStatusToDelete(null);
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
                          <Input placeholder="e.g., Active" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2 pt-2">
                    <Button type="submit" className="w-full">
                      {isEditing ? "Update Status" : "Add Status"}
                    </Button>
                    {isEditing && (
                      <Button type="button" variant="outline" className="w-full" onClick={handleCancelEdit}>
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
              {statuses.length === 0 && (
                <p className="text-muted-foreground">No statuses have been added yet.</p>
              )}
              {statuses.map((status, index) => (
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
                  {index < statuses.length - 1 && <Separator className="my-4" />}
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
            <AlertDialogCancel onClick={() => setStatusToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
