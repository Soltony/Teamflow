
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
import type { Department } from "@prisma/client";
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
import { createDepartment, deleteDepartment, updateDepartment } from "@/app/departments/actions";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";

const departmentSchema = z.object({
  name: z.string().min(3, "PMO Division name must be at least 3 characters."),
  responsibleName: z.string().min(3, "Responsible person's name is required."),
  responsibleTitle: z.string().min(3, "Title is required."),
  responsiblePhone: z.string().regex(/^09\d{8}$/, "Phone number must be 10 digits and start with 09."),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export function DepartmentsManagement({ initialDepartments }: { initialDepartments: Department[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const { hasPermission } = useAuth();
  
  const canCreate = hasPermission('departments:create');
  const canUpdate = hasPermission('departments:update');
  const canDelete = hasPermission('departments:delete');

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      responsibleName: "",
      responsibleTitle: "",
      responsiblePhone: "",
    },
  });

  const isEditing = editingDepartment !== null;

  function onSubmit(data: DepartmentFormValues) {
    startTransition(async () => {
      const result = isEditing
        ? await updateDepartment(editingDepartment!.id, data)
        : await createDepartment(data);

      if (result.success) {
        toast({
          title: isEditing ? "PMO Division Updated!" : "PMO Division Added!",
          description: `The "${data.name}" PMO division has been successfully saved.`,
        });
        setEditingDepartment(null);
        form.reset({ name: "", responsibleName: "", responsibleTitle: "", responsiblePhone: "" });
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleEdit(department: Department) {
    setEditingDepartment(department);
    form.reset({
      name: department.name,
      responsibleName: department.responsibleName,
      responsibleTitle: department.responsibleTitle,
      responsiblePhone: department.responsiblePhone,
    });
  }

  function handleCancelEdit() {
    setEditingDepartment(null);
    form.reset({ name: "", responsibleName: "", responsibleTitle: "", responsiblePhone: "" });
  }

  function handleDeleteConfirm() {
    if (!departmentToDelete) return;
    startTransition(async () => {
      const result = await deleteDepartment(departmentToDelete.id);
      if (result.success) {
        toast({
          title: "PMO Division Deleted",
          description: `The "${departmentToDelete.name}" PMO division has been removed.`,
        });
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      }
      setDepartmentToDelete(null);
    });
  }

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        {(canCreate || canUpdate) && (
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>{isEditing ? "Edit PMO Division" : "Add New PMO Division"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PMO Division Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Marketing" {...field} disabled={isPending || (isEditing && !canUpdate) || (!isEditing && !canCreate)} />
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
                            <Input placeholder="e.g., John Doe" {...field} disabled={isPending || (isEditing && !canUpdate) || (!isEditing && !canCreate)} />
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
                            <Input placeholder="e.g., Head of Marketing" {...field} disabled={isPending || (isEditing && !canUpdate) || (!isEditing && !canCreate)} />
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
                            <Input placeholder="0912345678" {...field} disabled={isPending || (isEditing && !canUpdate) || (!isEditing && !canCreate)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2 pt-2">
                      <Button type="submit" className="w-full" disabled={isPending || (isEditing && !canUpdate) || (!isEditing && !canCreate)}>
                         {isPending ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update PMO Division" : "Add PMO Division")}
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
        <div className={(canCreate || canUpdate) ? "md:col-span-2" : "md:col-span-3"}>
          <Card>
            <CardHeader>
              <CardTitle>Existing PMO Divisions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {initialDepartments.length === 0 && (
                <p className="text-muted-foreground">No PMO divisions have been added yet.</p>
              )}
              {initialDepartments.map((dept, index) => (
                <div key={dept.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{dept.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {dept.responsibleName}, {dept.responsibleTitle}
                      </p>
                      <p className="text-sm text-muted-foreground">{dept.responsiblePhone}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {canUpdate && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(dept)}>
                          <Pencil className="w-4 h-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDepartmentToDelete(dept)}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  {index < initialDepartments.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!departmentToDelete} onOpenChange={(open) => !open && setDepartmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              <span className="font-semibold">{departmentToDelete?.name}</span> PMO division.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDepartmentToDelete(null)}>Cancel</AlertDialogCancel>
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
