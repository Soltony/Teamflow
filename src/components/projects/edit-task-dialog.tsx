
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
import type { Milestone, Task, User, TaskStatus } from "@/lib/types";
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


type EditTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: Milestone;
  task: Task;
  users: User[];
  onTaskUpdate: (milestoneId: string, updatedTask: Task) => Promise<void>;
};

export function EditTaskDialog({ isOpen, onOpenChange, milestone, task, users, onTaskUpdate }: EditTaskDialogProps) {

  const weightOfOtherTasks = useMemo(() => {
    return milestone.tasks
      .filter(t => t.id !== task.id)
      .reduce((sum, t) => sum + t.weight, 0);
  }, [milestone.tasks, task.id]);
  const maxWeightForThisTask = 100 - weightOfOtherTasks;

  const taskSchema = useMemo(() => z.object({
    title: z.string().min(3, "Task title must be at least 3 characters."),
    description: z.string().optional(),
    startDate: z.date({ required_error: "A start date is required."}),
    endDate: z.date({ required_error: "An end date is required."}),
    assignedUserIds: z.array(z.string()).nonempty({ message: "At least one user must be assigned." }),
    weight: z.number().min(0).max(100),
    status: z.enum(taskStatuses),
  }).refine(data => data.endDate >= data.startDate, {
      message: "End date must be on or after start date.",
      path: ["endDate"],
  }).refine(data => {
      return data.weight <= maxWeightForThisTask;
  }, {
      message: `Total task weight for this milestone cannot exceed 100%. Max for this task: ${maxWeightForThisTask}%.`,
      path: ["weight"],
  }).superRefine((data, ctx) => {
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
  }), [maxWeightForThisTask, milestone.startDate, milestone.dueDate]);

  type TaskFormValues = z.infer<typeof taskSchema>;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: task.title,
        description: task.description,
        startDate: parseISO(task.startDate),
        endDate: parseISO(task.endDate),
        assignedUserIds: task.assignedUserIds,
        weight: task.weight,
        status: task.status,
      });
    }
  }, [isOpen, task, form]);


  const selectedUsers = users.filter(user => form.watch('assignedUserIds')?.includes(user.id));
  
  async function onSubmit(data: TaskFormValues) {
    const updatedTask: Task = {
      ...task,
      title: data.title,
      description: data.description || "",
      status: data.status,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate.toISOString(),
      assignedUserIds: data.assignedUserIds,
      weight: data.weight,
    };
    await onTaskUpdate(milestone.id, updatedTask);
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
          <DialogTitle>Edit Task in "{milestone.title}"</DialogTitle>
          <DialogDescription>Make changes to the task details. The total weight of all tasks in a milestone cannot exceed 100%.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                  <FormLabel>Assign to Users</FormLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full justify-start", !field.value?.length && "text-muted-foreground")}>
                            {selectedUsers.length > 0
                                ? selectedUsers.map(u => u.name).join(', ')
                                : "Select users..."}
                          <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                      </FormControl>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                      {users.map((user) => (
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
                                    max={maxWeightForThisTask}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
