
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { Milestone, Project, Task, User, TaskStatus } from "@/lib/types";
import { Slider } from "../ui/slider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type UserWithRoles = User & { roles: { name: string }[] };

type AddTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project & { milestones: (Milestone & { tasks: Task[] })[] };
  users: UserWithRoles[];
  onTaskAdd: (projectId: string, milestoneId: string | null, newTask: Omit<Task, 'id' | 'status'>) => Promise<void>;
};

export function AddTaskDialog({ isOpen, onOpenChange, project, onTaskAdd, users }: AddTaskDialogProps) {

  const nonAdminUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(user => user.roles && !user.roles.some(role => role.name === 'Admin'));
  }, [users]);
  
  const hasMilestones = project.milestones && project.milestones.length > 0;

  const form = useForm<z.infer<ReturnType<typeof createTaskSchema>>>({
    resolver: zodResolver(createTaskSchema(project)),
  });

  const selectedMilestoneId = form.watch('milestoneId');
  
  const selectedMilestone = useMemo(() => {
    if (!selectedMilestoneId) return null;
    return project.milestones.find(m => m.id === selectedMilestoneId);
  }, [selectedMilestoneId, project.milestones]);

  const remainingWeight = useMemo(() => {
    if (!selectedMilestone) {
        // If no milestone is selected (which happens when a project has no milestones),
        // the new "General Tasks" milestone will have 100% weight available.
        return 100;
    }
    const existingTasksInMilestone = selectedMilestone.tasks || [];
    const existingTasksWeight = existingTasksInMilestone.reduce((sum, task) => sum + task.weight, 0);
    return 100 - existingTasksWeight;
  }, [selectedMilestone]);
  
  // By creating the schema inside the component, it can be reactive
  // to props and state like `remainingWeight` and `selectedMilestone`.
  function createTaskSchema(project: Project) {
      return z.object({
        title: z.string().min(3, "Task title must be at least 3 characters."),
        description: z.string().optional(),
        startDate: z.date({ required_error: "A start date is required."}),
        endDate: z.date({ required_error: "An end date is required."}),
        assignedUserIds: z.array(z.string()).nonempty({ message: "At least one user must be assigned." }),
        weight: z.number().min(0).max(100),
        milestoneId: z.string().optional(),
      }).refine(data => data.endDate >= data.startDate, {
          message: "End date must be on or after start date.",
          path: ["endDate"],
      }).superRefine((data, ctx) => {
        const milestone = data.milestoneId ? project.milestones.find(m => m.id === data.milestoneId) : null;
        
        const currentRemainingWeight = (() => {
            if (!milestone) return 100;
            const existingTasksWeight = (milestone.tasks || []).reduce((sum, task) => sum + task.weight, 0);
            return 100 - existingTasksWeight;
        })();

        if (data.weight > currentRemainingWeight) {
            ctx.addIssue({
                path: ['weight'],
                message: `Total task weight for this milestone cannot exceed 100%. Remaining: ${currentRemainingWeight}%.`,
            });
        }
        
        if (milestone) {
             if (data.startDate < parseISO(milestone.startDate)) {
                ctx.addIssue({
                    path: ['startDate'],
                    message: `Must be on or after milestone start: ${format(parseISO(milestone.startDate), 'MMM d')}.`
                });
            }
            if (data.endDate > parseISO(milestone.dueDate)) {
                ctx.addIssue({
                    path: ['endDate'],
                    message: `Must be on or before milestone due date: ${format(parseISO(milestone.dueDate), 'MMM d')}.`
                });
            }
        }
      });
  }

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: "",
        description: "",
        startDate: new Date(),
        endDate: new Date(),
        assignedUserIds: [],
        weight: 10,
        milestoneId: hasMilestones ? project.milestones?.[0]?.id : undefined,
      });
    }
  }, [isOpen, project, form, hasMilestones]);


  const selectedUsers = (users || []).filter(user => form.watch('assignedUserIds')?.includes(user.id));

  async function onSubmit(data: z.infer<ReturnType<typeof createTaskSchema>>) {
    const { milestoneId, ...newTaskData } = data;
    await onTaskAdd(project.id, milestoneId || null, newTaskData as any);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
            form.reset();
        }
    }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Task to "{project.name}"</DialogTitle>
          <DialogDescription>Fill in the details for the new task. The total weight of all tasks in a milestone cannot exceed 100%.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {hasMilestones && (
                <FormField
                control={form.control}
                name="milestoneId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Milestone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a milestone" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {project.milestones.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Setup database schema" {...field} />
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the task requirements..." {...field} />
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
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
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
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <FormField
              control={form.control}
              name="assignedUserIds"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Select members</FormLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full justify-start", !field.value?.length && "text-muted-foreground")}>
                            {selectedUsers.length > 0
                                ? `${selectedUsers.length} member(s) selected`
                                : "Select members..."}
                          <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                      </FormControl>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                      {nonAdminUsers.map((user) => (
                        <DropdownMenuCheckboxItem
                          key={user.id}
                          checked={field.value?.includes(user.id)}
                          onCheckedChange={(checked) => {
                            const newValues = field.value ? [...field.value] : [];
                            if (checked) {
                              newValues.push(user.id);
                            } else {
                              const index = newValues.indexOf(user.id);
                              if (index > -1) {
                                newValues.splice(index, 1);
                              }
                            }
                            field.onChange(newValues);
                          }}
                           onSelect={(e) => e.preventDefault()}
                        >
                          {user.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Task Weight (Remaining in milestone: {remainingWeight}%): {field.value}%</FormLabel>
                        <FormControl>
                            <Slider
                                value={[field.value ?? 0]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={remainingWeight > 0 ? remainingWeight : 0}
                                step={5}
                                disabled={!selectedMilestone && hasMilestones}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding..." : "Add Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
