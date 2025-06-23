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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { departments as initialDepartments } from "@/lib/data";
import type { Department } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const departmentSchema = z.object({
  name: z.string().min(3, "Department name must be at least 3 characters."),
  responsibleName: z.string().min(3, "Responsible person's name is required."),
  responsibleTitle: z.string().min(3, "Title is required."),
  responsiblePhone: z.string().min(10, "A valid phone number is required."),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export function DepartmentsManagement() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      responsibleName: "",
      responsibleTitle: "",
      responsiblePhone: "",
    },
  });

  function onSubmit(data: DepartmentFormValues) {
    const newDepartment: Department = {
      id: `dept-${Date.now()}`,
      name: data.name,
      responsible: {
        name: data.responsibleName,
        title: data.responsibleTitle,
        phone: data.responsiblePhone,
      },
    };
    setDepartments([...departments, newDepartment]);
    toast({
      title: "Department Added!",
      description: `The "${data.name}" department has been successfully created.`,
    });
    form.reset();
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <Card>
            <CardHeader>
                <CardTitle>Add New Department</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Department Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Marketing" {...field} />
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
                                    <Input placeholder="e.g., John Doe" {...field} />
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
                                    <Input placeholder="e.g., Head of Marketing" {...field} />
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
                                    <Input placeholder="e.g., (123) 456-7890" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full">Add Department</Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
      </div>
      <div className="md:col-span-2">
         <Card>
            <CardHeader>
                <CardTitle>Existing Departments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {departments.length === 0 && (
                    <p className="text-muted-foreground">No departments have been added yet.</p>
                )}
                {departments.map((dept, index) => (
                    <div key={dept.id}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-semibold">{dept.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {dept.responsible.name}, {dept.responsible.title}
                                </p>
                                <p className="text-sm text-muted-foreground">{dept.responsible.phone}</p>
                            </div>
                        </div>
                        {index < departments.length - 1 && <Separator className="my-4" />}
                    </div>
                ))}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
