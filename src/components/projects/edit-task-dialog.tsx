
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
import { useToast } from "@/hooks/use-toast";
import { Slider } from "../ui/slider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useEffect } from "react";

const taskStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'PENDING_REVIEW', 'DONE'];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const formatStatus = (s: string) => capitalize(s.replace(/_/g, ' ').toLowerCase());

type UserWithRoles = User & { roles: { name: string }[] };

type EditTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project & { milestones: (Milestone & {tasks: Task[]})[], tasks?: Task[] };
  task: Task;
  users: UserWithRoles[];
  onTaskUpdate: (updatedTask: Task) => Promise<void>;
};

export function EditTaskDialog({ isOpen, onOpenChange, project, task, users, onTaskUpdate }: EditTaskDialogProps) {
  const userCreatedMilestones = useMemo(() => {
    return project.milestones?.filter(m => m.title !== "General Tasks") || [];
  }, [project.milestones]);
  
  const hasMilestones = userCreatedMilestones.length > 0;

  const nonAdminUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(user => user.roles && !user.roles.some(role => role.name === 'Admin'));
  }, [users]);

  const taskSchema = useMemo(() => z.object({
    title: z.string().min(3, "Task title must be at least 3 characters."),
    description: z.string().optional(),
    startDate: z.date({ required_error: "A start date is required."}),
    endDate: z.date({ required_error: "An end date is required."}),
    assignedUserIds: z.array(z.string()).nonempty({ message: "At least one user must be assigned." }),
    weight: z.number().min(0, "Weight must be a positive number."),
    status: z.enum(taskStatuses),
    milestoneId: z.string().optional(),
  }).refine(data => data.endDate >= data.startDate, {
      message: "End date must be on or after start date.",
      path: ["endDate"],
  }).superRefine((data, ctx) => {
    if (hasMilestones && !data.milestoneId) {
      ctx.addIssue({
        path: ["milestoneId"],
        message: "A milestone must be selected for this project.",
        code: z.ZodIssueCode.custom
      });
      return; // Stop further validation if milestone is required but missing
    }

    const selectedMilestone = data.milestoneId
      ? project.milestones.find((m) => m.id === data.milestoneId) || null
      : null;

    if (selectedMilestone) {
      const milestoneTasks = selectedMilestone.tasks || [];
      const existingTasksWeight = milestoneTasks
        .filter((t) => t.id !== task.id)
        .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);

      const maxWeightForThisTask = Math.max(0, 100 - existingTasksWeight);

      if (data.weight > maxWeightForThisTask + 1e-6) { // Use a small epsilon for float comparison
        ctx.addIssue({
          path: ["weight"],
          message: `Weight exceeds remaining ${maxWeightForThisTask}% for milestone tasks.`,
        });
      }

      if (selectedMilestone.startDate && data.startDate < parseISO(selectedMilestone.startDate)) {
        ctx.addIssue({
          path: ["startDate"],
          message: `Must be on or after milestone start: ${format(parseISO(selectedMilestone.startDate), "MMM d")}.`,
        });
      }
      if (selectedMilestone.dueDate && data.endDate > parseISO(selectedMilestone.dueDate)) {
        ctx.addIssue({
          path: ["endDate"],
          message: `Must be on or before milestone due date: ${format(parseISO(selectedMilestone.dueDate), "MMM d")}.`,
        });
      }
    } else if (!hasMilestones) { // Only run project-level validation if there are no milestones at all
        if (project.startDate && data.startDate < parseISO(project.startDate)) {
            ctx.addIssue({
            path: ["startDate"],
            message: `Must be on or after project start date: ${format(parseISO(project.startDate), "MMM d")}.`,
            });
        }
        if (project.endDate && data.endDate > parseISO(project.endDate)) {
            ctx.addIssue({
            path: ["endDate"],
            message: `Must be on or before project end date: ${format(parseISO(project.endDate), "MMM d")}.`,
            });
        }
    }
  }), [project, task.id, hasMilestones]);

  type TaskFormValues = z.infer<typeof taskSchema>;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
  });
  
  useEffect(() => {
    if (isOpen && task) {
      const assigneeIds: string[] =
        (task as any).assignedUserIds ??
        (Array.isArray((task as any).assignees) ? (task as any).assignees.map((u: any) => u.id) : []) ??
        [];
  
      const initialMilestoneId = task.milestoneId ?? undefined;
  
      form.reset({
        title: task.title,
        description: task.description || "",
        startDate: parseISO(task.startDate),
        endDate: parseISO(task.endDate),
        assignedUserIds: assigneeIds,
        weight: task.weight,
        status: task.status,
        milestoneId: initialMilestoneId,
      });
    }
  }, [isOpen, task, form]);
  
  const selectedMilestoneId = form.watch('milestoneId');
  const assignedUserIds = form.watch('assignedUserIds');
  
  const selectedMilestone = useMemo(() => {
    if (!selectedMilestoneId) return null;
    return project.milestones.find(m => m.id === selectedMilestoneId);
  }, [selectedMilestoneId, project.milestones]);

  const maxWeightForThisTask = useMemo(() => {
    if (selectedMilestone) {
      const otherTasksWeight = (selectedMilestone.tasks || [])
        .filter((t) => t.id !== task.id)
        .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);
  
      return Math.max(0, 100 - otherTasksWeight);
    }
    // If no milestone is selected (only possible if project has no milestones), assume full 100% is available for project-level tasks logic
    return 100;
  }, [selectedMilestone, task.id, project.milestones]);

  const selectedUsers = useMemo(() => 
    (users || []).filter(user => assignedUserIds?.includes(user.id)),
    [users, assignedUserIds]
  );
  
  async function onSubmit(data: TaskFormValues) {
    const { milestoneId, ...taskData } = data;
    const finalMilestoneId = milestoneId === '' ? undefined : milestoneId
    const updatedTask: Task = {
      ...task,
      ...taskData,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate.toISOString(),
      milestoneId: finalMilestoneId,
    };
    await onTaskUpdate(updatedTask);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
            form.reset();
        }
    }}>
      <DialogContent className="sm:max-w-2xl p-0 flex flex-col max-h-[90dvh]">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Edit Task in "{project.name}"</DialogTitle>
          <DialogDescription>Make changes to the task details. The total weight of all tasks in a milestone cannot exceed 100%.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6">
            <Form {...form}>
              <form id="edit-task-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                 {hasMilestones && (
                    <FormField
                    control={form.control}
                    name="milestoneId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Assign to milestone</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a milestone" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {userCreatedMilestones.map(m => (
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
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !field.value?.length && "text-muted-foreground")}>
                                <span className="truncate">
                                {selectedUsers.length > 0
                                    ? selectedUsers.map(u => u.name).join(', ')
                                    : "Select members..."}
                                </span>
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
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Task Weight (Max: {maxWeightForThisTask}%): {field.value}%</FormLabel>
                                <FormControl>
                                    <Slider
                                        value={[field.value ?? 0]}
                                        onValueChange={(value) => field.onChange(value[0])}
                                        max={Math.max(0, maxWeightForThisTask)}
                                        step={5}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {taskStatuses.map(status => <SelectItem key={status} value={status}>{formatStatus(status)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
              </form>
            </Form>
        </div>
        <DialogFooter className="p-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="edit-task-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
