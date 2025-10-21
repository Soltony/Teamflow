

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
import type { Milestone, Project, Task, User } from "@/lib/types";
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
  milestone: Milestone;
  users: UserWithRoles[];
  onTaskAdd: (milestoneId: string, newTask: Omit<Task, 'id' | 'status'>) => Promise<void>;
};

export function AddTaskDialog({ isOpen, onOpenChange, milestone, onTaskAdd, users }: AddTaskDialogProps) {

  const nonAdminUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(user => user.roles && !user.roles.some(role => role.name === 'Admin'));
  }, [users]);

  const existingTasksWeight = useMemo(() => {
    if (!milestone?.tasks) return 0;
    return milestone.tasks.reduce((sum, task) => sum + task.weight, 0);
  }, [milestone]);

  const remainingWeight = 100 - existingTasksWeight;

  const taskSchema = useMemo(() => z.object({
    title: z.string().min(3, "Task title must be at least 3 characters."),
    description: z.string().optional(),
    startDate: z.date({ required_error: "A start date is required."}),
    endDate: z.date({ required_error: "An end date is required."}),
    assignedUserIds: z.array(z.string()).nonempty({ message: "At least one user must be assigned." }),
    weight: z.number().min(0).max(100),
  }).refine(data => data.endDate >= data.startDate, {
      message: "End date must be on or after start date.",
      path: ["endDate"],
  }).refine(data => {
      return data.weight <= remainingWeight;
  }, {
      message: `Total task weight for this milestone cannot exceed 100%. Remaining: ${remainingWeight}%.`,
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
            message: `Must be on or before milestone end date: ${format(parseISO(milestone.dueDate), 'MMM d')}.`
        });
    }
  }), [remainingWeight, milestone]);

  type TaskFormValues = z.infer<typeof taskSchema>;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
  });
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: "",
        description: "",
        startDate: new Date(),
        endDate: new Date(),
        assignedUserIds: [],
        weight: Math.min(10, remainingWeight > 0 ? remainingWeight : 0),
      });
    }
  }, [isOpen, milestone.id, remainingWeight, form]);


  const selectedUsers = (users || []).filter(user => form.watch('assignedUserIds')?.includes(user.id));

  async function onSubmit(data: TaskFormValues) {
    const newTask = {
      title: data.title,
      description: data.description || "",
      startDate: data.startDate,
      endDate: data.endDate,
      assignedUserIds: data.assignedUserIds,
      weight: data.weight,
    };
    await onTaskAdd(milestone.id, newTask as any);
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
          <DialogTitle>Add New Task to "{milestone.title}"</DialogTitle>
          <DialogDescription>Fill in the details for the new task. The total weight of all tasks in a milestone cannot exceed 100%.</DialogDescription>
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
                        <FormLabel>Task Weight (Remaining available in milestone: {remainingWeight}%): {field.value}%</FormLabel>
                        <FormControl>
                            <Slider
                                value={[field.value ?? 0]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={remainingWeight > 0 ? remainingWeight : 0}
                                step={5}
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
