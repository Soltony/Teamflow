
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
import type { PmoDivision } from "@prisma/client";
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
import { createPmoDivision, deletePmoDivision, updatePmoDivision } from "@/app/pmo-divisions/actions";
import { useAuth } from "@/context/auth-context";

const pmoDivisionSchema = z.object({
  name: z.string().min(3, "Division name must be at least 3 characters."),
  responsibleName: z.string().min(3, "Responsible person's name is required."),
  responsibleTitle: z.string().min(3, "Title is required."),
  responsiblePhone: z.string().regex(/^09\d{8}$/, "Phone number must be in 0912345678 format."),
});

type PmoDivisionFormValues = z.infer<typeof pmoDivisionSchema>;

type PmoDivisionManagementProps = {
    initialPmoDivisions: PmoDivision[];
    onDataChange: () => void;
};

export function PmoDivisionManagement({ initialPmoDivisions, onDataChange }: PmoDivisionManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingPmoDivision, setEditingPmoDivision] = useState<PmoDivision | null>(null);
  const [pmoDivisionToDelete, setPmoDivisionToDelete] = useState<PmoDivision | null>(null);
  const { hasPermission } = useAuth();
  
  const canManage = hasPermission('pmo-divisions:view'); // Assuming one permission for now

  const form = useForm<PmoDivisionFormValues>({
    resolver: zodResolver(pmoDivisionSchema),
    defaultValues: {
      name: "",
      responsibleName: "",
      responsibleTitle: "",
      responsiblePhone: "",
    },
  });

  const isEditing = editingPmoDivision !== null;

  function onSubmit(data: PmoDivisionFormValues) {
    startTransition(async () => {
      const result = isEditing
        ? await updatePmoDivision(editingPmoDivision!.id, data)
        : await createPmoDivision(data);

      if (result.success) {
        toast({
          title: isEditing ? "EPMO Division Updated!" : "EPMO Division Added!",
          description: `The "${data.name}" division has been successfully saved.`,
        });
        setEditingPmoDivision(null);
        form.reset({ name: "", responsibleName: "", responsibleTitle: "", responsiblePhone: "" });
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleEdit(pmoDivision: PmoDivision) {
    setEditingPmoDivision(pmoDivision);
    form.reset({
      name: pmoDivision.name,
      responsibleName: pmoDivision.responsibleName,
      responsibleTitle: pmoDivision.responsibleTitle,
      responsiblePhone: pmoDivision.responsiblePhone,
    });
  }

  function handleCancelEdit() {
    setEditingPmoDivision(null);
    form.reset({ name: "", responsibleName: "", responsibleTitle: "", responsiblePhone: "" });
  }

  function handleDeleteConfirm() {
    startTransition(async () => {
      if (!pmoDivisionToDelete) return;
      const result = await deletePmoDivision(pmoDivisionToDelete.id);
      if (result.success) {
        toast({
          title: "EPMO Division Deleted",
          description: `The "${pmoDivisionToDelete.name}" division has been removed.`,
        });
        onDataChange();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      }
      setPmoDivisionToDelete(null);
    });
  }

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        {canManage && (
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>{isEditing ? "Edit EPMO Division" : "Add New EPMO Division"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>EPMO Division Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Marketing" {...field} disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="responsibleName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Responsible Person</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., John Doe" {...field} disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="responsibleTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Head of Marketing" {...field} disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="responsiblePhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="0912345678" {...field} disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2 pt-2">
                      <Button type="submit" className="w-full" disabled={isPending}>
                         {isPending ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update EPMO Division" : "Add EPMO Division")}
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
        <div className={canManage ? "md:col-span-2" : "md:col-span-3"}>
          <Card>
            <CardHeader>
              <CardTitle>Existing EPMO Divisions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {initialPmoDivisions.length === 0 && (
                <p className="text-muted-foreground">No EPMO divisions have been added yet.</p>
              )}
              {initialPmoDivisions.map((div, index) => (
                <div key={div.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{div.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {div.responsibleName}, {div.responsibleTitle}
                      </p>
                      <p className="text-sm text-muted-foreground">{div.responsiblePhone}</p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(div)}>
                          <Pencil className="w-4 h-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPmoDivisionToDelete(div)}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    )}
                  </div>
                  {index < initialPmoDivisions.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!pmoDivisionToDelete} onOpenChange={(open) => !open && setPmoDivisionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              <span className="font-semibold">{pmoDivisionToDelete?.name}</span> EPMO division.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPmoDivisionToDelete(null)} disabled={isPending}>Cancel</AlertDialogCancel>
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
