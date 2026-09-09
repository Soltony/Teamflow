
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
import type { Initiative } from "@prisma/client";
import type { Serialized } from "@/lib/serialize";
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
import { createInitiative, deleteInitiative, updateInitiative } from "@/app/initiatives/actions";
import { useAuth } from "@/context/auth-context";

const initiativeSchema = z.object({
  name: z.string().min(3, "Initiative name must be at least 3 characters."),
});

type InitiativeFormValues = z.infer<typeof initiativeSchema>;

type InitiativesManagementProps = {
    initialInitiatives: Serialized<Initiative>[];
    onDataChange: () => void;
};

export function InitiativesManagement({ initialInitiatives, onDataChange }: InitiativesManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingInitiative, setEditingInitiative] = useState<Serialized<Initiative> | null>(null);
  const [initiativeToDelete, setInitiativeToDelete] = useState<Serialized<Initiative> | null>(null);
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('initiatives:create');
  const canUpdate = hasPermission('initiatives:update');
  const canDelete = hasPermission('initiatives:delete');

  const form = useForm<InitiativeFormValues>({
    resolver: zodResolver(initiativeSchema),
    defaultValues: {
      name: "",
    },
  });

  const isEditing = editingInitiative !== null;

  function onSubmit(data: InitiativeFormValues) {
    startTransition(async () => {
      const result = isEditing
        ? await updateInitiative(editingInitiative!.id, data)
        : await createInitiative(data);

      if (result.success) {
        toast({
          title: isEditing ? "Initiative Updated!" : "Initiative Added!",
          description: `The "${data.name}" initiative has been successfully saved.`,
        });
        setEditingInitiative(null);
        form.reset({ name: "" });
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleEdit(initiative: Serialized<Initiative>) {
    setEditingInitiative(initiative);
    form.reset({
      name: initiative.name,
    });
  }

  function handleCancelEdit() {
    setEditingInitiative(null);
    form.reset({ name: "" });
  }

  function handleDeleteConfirm() {
    if (!initiativeToDelete) return;
    startTransition(async () => {
      const result = await deleteInitiative(initiativeToDelete.id);
      if (result.success) {
        toast({
          title: "Initiative Deleted",
          description: `The "${initiativeToDelete.name}" initiative has been removed.`,
        });
        onDataChange();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      }
      setInitiativeToDelete(null);
    });
  }

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        {canCreate && (
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>{isEditing ? "Edit Initiative" : "Add New Initiative"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initiative Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Digital Transformation" {...field} disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2 pt-2">
                      <Button type="submit" className="w-full" disabled={isPending}>
                         {isPending ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update Initiative" : "Add Initiative")}
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
        )}
        <div className={canCreate ? "md:col-span-2" : "md:col-span-3"}>
          <Card>
            <CardHeader>
              <CardTitle>Existing Initiatives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {initialInitiatives.length === 0 && (
                <p className="text-muted-foreground">No initiatives have been added yet.</p>
              )}
              {initialInitiatives.map((initiative, index) => (
                <div key={initiative.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{initiative.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        {canUpdate && (
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(initiative)}>
                            <Pencil className="w-4 h-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setInitiativeToDelete(initiative)}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                    </div>
                  </div>
                  {index < initialInitiatives.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!initiativeToDelete} onOpenChange={(open) => !open && setInitiativeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              <span className="font-semibold">{initiativeToDelete?.name}</span> initiative.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInitiativeToDelete(null)}>Cancel</AlertDialogCancel>
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
