
"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronDown, PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import type { User, Department, ProjectStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";


const milestoneSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  startDate: z.date(),
  dueDate: z.date(),
  weight: z.coerce.number().min(1, "Weight must be between 1 and 100.").max(100, "Weight must be between 1 and 100."),
  responsibleDepartmentIds: z.array(z.string()).nonempty({ message: "At least one department must be responsible." }),
}).refine(data => data.dueDate >= data.startDate, {
    message: "Due date must be on or after the start date.",
    path: ["dueDate"],
});

const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  startDate: z.date({ required_error: "A start date is required."}),
  endDate: z.date({ required_error: "An end date is required."}),
  workingYear: z.string().nonempty("An active working year must be set on the Settings page."),
  statusId: z.string().nonempty("Please select a project status."),
  departmentId: z.string().nonempty("Please select a department."),
  projectManagerId: z.string().nonempty("Please select a project manager."),
  milestones: z.array(milestoneSchema),
}).refine(data => data.endDate > data.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
}).refine(data => {
    if (data.milestones.length === 0) return true;
    const totalWeight = data.milestones.reduce((sum, m) => sum + m.weight, 0);
    return totalWeight === 100;
}, {
    message: "The sum of all milestone weights must be exactly 100.",
    path: ["milestones"],
}).superRefine((data, ctx) => {
    data.milestones.forEach((milestone, index) => {
        if (milestone.startDate < data.startDate) {
            ctx.addIssue({
                path: [`milestones.${index}.startDate`],
                message: "Start date cannot be before the project's start date.",
                code: z.ZodIssueCode.custom
            });
        }
        if (milestone.dueDate > data.endDate) {
            ctx.addIssue({
                path: [`milestones.${index}.dueDate`],
                message: "Due date cannot be after the project's end date.",
                code: z.ZodIssueCode.custom
            });
        }
    });
});

type ProjectFormValues = z.infer<typeof projectSchema>;

type ProjectFormProps = {
  mode: 'create' | 'edit';
  initialData?: ProjectFormValues;
  users: User[];
  departments: Department[];
  projectStatuses: ProjectStatus[];
  activeYear?: string;
  onSubmit: (data: ProjectFormValues) => Promise<any>;
}

export function ProjectForm({ mode, initialData, users, departments, projectStatuses, activeYear, onSubmit }: ProjectFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = mode === 'edit';

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: isEditMode && initialData ? initialData : {
      name: "",
      description: "",
      workingYear: activeYear || "",
      statusId: "",
      departmentId: "",
      projectManagerId: "",
      milestones: [],
    },
  });

  useEffect(() => {
    if (isEditMode && initialData) {
      form.reset(initialData);
    }
  }, [initialData, isEditMode, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  const milestonesError = form.formState.errors.milestones?.root;

  async function handleFormSubmit(data: ProjectFormValues) {
    setIsSubmitting(true);
    await onSubmit(data);
    setIsSubmitting(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
        <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                      <Input placeholder="e.g., E-commerce Platform Relaunch" {...field} />
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
                  <FormLabel>Project Description</FormLabel>
                  <FormControl>
                      <Textarea placeholder="Describe the project goals and objectives." {...field} />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                                )}
                            >
                                {field.value ? (
                                format(field.value, "PPP")
                                ) : (
                                <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>End Date</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                                )}
                            >
                                {field.value ? (
                                format(field.value, "PPP")
                                ) : (
                                <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                                date < (form.getValues("startDate") || new Date("1900-01-01"))
                            }
                            initialFocus
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Owning Department</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select an Owning Department" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {departments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="projectManagerId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project Manager</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a project manager" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="statusId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {projectStatuses.map(status => <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="workingYear"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Working Year</FormLabel>
                        <FormControl>
                            <Input placeholder="Set active year in Settings" {...field} disabled />
                        </FormControl>
                        <FormDescription>
                            {isEditMode ? "The working year cannot be changed." : "The working year is automatically set based on the active year from Settings."}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
             </div>
        </div>
        
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Milestones</h3>
                <p className="text-sm text-muted-foreground">Define the major milestones for this project. The sum of all milestone weights must equal 100%.</p>
            </div>
            {fields.map((field, index) => (
              <Card key={field.id} className="relative">
                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => remove(index)}>
                    <X className="h-4 w-4" />
                </Button>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <FormField
                          control={form.control}
                          name={`milestones.${index}.title`}
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Milestone Title</FormLabel>
                              <FormControl>
                                  <Input placeholder="e.g., Q1 Goals" {...field} />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                      
                      <FormField
                          control={form.control}
                          name={`milestones.${index}.description`}
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Milestone Description</FormLabel>
                              <FormControl>
                                  <Textarea placeholder="Describe the milestone goals and deliverables." {...field} />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                  </div>
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <FormField
                              control={form.control}
                              name={`milestones.${index}.startDate`}
                              render={({ field: dateField }) => (
                              <FormItem className="flex flex-col">
                                  <FormLabel>Start Date</FormLabel>
                                  <Popover>
                                  <PopoverTrigger asChild>
                                      <FormControl>
                                      <Button
                                          variant={"outline"}
                                          className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}
                                      >
                                          {dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                      </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                                  </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                              </FormItem>
                              )}
                          />
                          <FormField
                              control={form.control}
                              name={`milestones.${index}.dueDate`}
                              render={({ field: dateField }) => (
                              <FormItem className="flex flex-col">
                                  <FormLabel>Due Date</FormLabel>
                                  <Popover>
                                  <PopoverTrigger asChild>
                                      <FormControl>
                                      <Button
                                          variant={"outline"}
                                          className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}
                                      >
                                          {dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                      </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                                  </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                              </FormItem>
                              )}
                          />
                      </div>

                      <FormField
                          control={form.control}
                          name={`milestones.${index}.responsibleDepartmentIds`}
                          render={({ field }) => {
                              const selectedDepts = departments.filter(dept => field.value?.includes(dept.id));
                              return (
                              <FormItem className="flex flex-col">
                                <FormLabel>Responsible Departments</FormLabel>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <FormControl>
                                      <Button variant="outline" className={cn("w-full justify-start", !field.value?.length && "text-muted-foreground")}>
                                          {selectedDepts.length > 0
                                              ? selectedDepts.map(d => d.name).join(', ')
                                              : "Select departments..."}
                                        <ChevronDown className="ml-auto h-4 w-4" />
                                      </Button>
                                    </FormControl>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                    {departments.map((dept) => (
                                      <DropdownMenuCheckboxItem
                                        key={dept.id}
                                        checked={field.value?.includes(dept.id)}
                                        onCheckedChange={(checked) => {
                                          const newValues = field.value ? [...field.value] : [];
                                          if (checked) {
                                            newValues.push(dept.id);
                                          } else {
                                            const idx = newValues.indexOf(dept.id);
                                            if (idx > -1) newValues.splice(idx, 1);
                                          }
                                          field.onChange(newValues);
                                        }}
                                      >
                                        {dept.name}
                                      </DropdownMenuCheckboxItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <FormMessage />
                              </FormItem>
                              )
                          }}
                      />

                      <FormField
                          control={form.control}
                          name={`milestones.${index}.weight`}
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Milestone Weight (%)</FormLabel>
                              <FormControl>
                                  <Input type="number" placeholder="e.g., 25" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => append({ title: '', description: '', startDate: new Date(), dueDate: new Date(), weight: 20, responsibleDepartmentIds: [] })}
            >
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Milestone
            </Button>
            {milestonesError && (
                <p className="text-sm font-medium text-destructive">{milestonesError.message}</p>
            )}
        </div>
        <Separator />
        <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Project')}
            </Button>
        </div>
      </form>
    </Form>
  );
}
