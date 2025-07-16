"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createDepartmentSimple, updateDepartmentName, deleteDepartmentAndUnlinkProjects } from "@/app/responsible-departments/actions";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import { ProjectListItem } from "./project-list-item";
import type { DepartmentWithProjects } from "@/app/responsible-departments/page";

const departmentSchema = z.object({
  name: z.string().min(2, { message: "Department name must be at least 2 characters." }),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export function DepartmentManagement({ initialDepartments }: { initialDepartments: DepartmentWithProjects[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentWithProjects | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<DepartmentWithProjects | null>(null);

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
  });

  const handleAddSubmit = (data: DepartmentFormValues) => {
    startTransition(async () => {
      const result = await createDepartmentSimple(data.name);
      if (result.success) {
        toast({ title: "Department Created", description: `"${data.name}" has been added.` });
        setIsAddDialogOpen(false);
        form.reset({ name: '' });
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  };

  const handleEditSubmit = (data: DepartmentFormValues) => {
    if (!editingDepartment) return;
    startTransition(async () => {
      const result = await updateDepartmentName(editingDepartment.id, data.name);
      if (result.success) {
        toast({ title: "Department Updated", description: `"${data.name}" has been updated.` });
        setEditingDepartment(null);
        form.reset({ name: '' });
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingDepartment) return;
    startTransition(async () => {
      const result = await deleteDepartmentAndUnlinkProjects(deletingDepartment.id);
      if (result.success) {
        toast({ title: "Department Deleted", description: `"${deletingDepartment.name}" has been removed.` });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
      setDeletingDepartment(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Department
        </Button>
      </div>
      <Accordion type="multiple" className="w-full" defaultValue={initialDepartments.map(d => d.id)}>
        {initialDepartments.map((dept) => (
          <AccordionItem value={dept.id} key={dept.id} className="border-b">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex justify-between items-center w-full pr-4">
                <span className="text-lg font-semibold">{dept.name}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingDepartment(dept); }}>
                    <Pencil className="w-4 h-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingDepartment(dept); }}>
                    <Trash2 className="w-4 h-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
              <h4 className="font-semibold text-muted-foreground mb-2">Projects Owned by this Department:</h4>
              {dept.projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dept.projects.map((project) => (
                    <ProjectListItem key={project.id} project={project as any} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No projects are currently owned by this department.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Department</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Technology" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add Department"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingDepartment} onOpenChange={() => setEditingDepartment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" defaultValue={editingDepartment?.name} render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingDepartment(null)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Alert Dialog */}
      <AlertDialog open={!!deletingDepartment} onOpenChange={() => setDeletingDepartment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingDepartment && deletingDepartment.projects.length > 0 && (
                <p className="mb-2 text-destructive-foreground bg-destructive p-3 rounded-md">
                  This department has {deletingDepartment.projects.length} project(s) assigned. Deleting it will remove the department, but the projects will remain. This action cannot be undone.
                </p>
              )}
              This will permanently delete the department: <span className="font-bold">{deletingDepartment?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}