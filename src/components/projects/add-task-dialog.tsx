

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
import type { Milestone, Project, Task, User, TaskStatus, Team } from "@/lib/types";
import { Slider } from "../ui/slider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "@/hooks/use-toast";

type UserWithRoles = User & { roles: { name: string }[] };
type ProjectWithTeamsAndMilestones = Project & { 
    teams: (Team & { members: User[], teamLead: User })[];
    milestones: (Milestone & { tasks: Task[] })[]; 
};

type AddTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithTeamsAndMilestones;
  users: UserWithRoles[];
  onTaskAdd: (projectId: string, milestoneId: string | null, newTask: Omit<Task, 'id' | 'status'>) => Promise<void>;
};

function createTaskSchema(project: ProjectWithTeamsAndMilestones, hasMilestones: boolean) {
    
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
      if (hasMilestones) {
          if (!data.milestoneId) {
            ctx.addIssue({
                path: ['milestoneId'],
                message: 'A milestone must be selected for this project.',
                code: z.ZodIssueCode.custom
            });
            return;
          }
          const milestone = project.milestones.find(m => m.id === data.milestoneId);
          if (milestone) {
              const existingTasksWeight = (milestone.tasks || []).reduce((sum, task) => sum + task.weight, 0);
              const remainingWeight = 100 - existingTasksWeight;

              if (data.weight > remainingWeight) {
                  ctx.addIssue({
                      path: ['weight'],
                      message: `Total task weight for this milestone cannot exceed 100%. Remaining: ${remainingWeight}%.`,
                  });
              }
              
              if (milestone.startDate && data.startDate < parseISO(milestone.startDate)) {
                  ctx.addIssue({
                      path: ['startDate'],
                      message: `Must be on or after milestone start: ${format(parseISO(milestone.startDate), 'MMM d')}.`
                  });
              }
              if (milestone.dueDate && data.endDate > parseISO(milestone.dueDate)) {
                  ctx.addIssue({
                      path: ['endDate'],
                      message: `Must be on or before milestone due date: ${format(parseISO(milestone.dueDate), 'MMM d')}.`
                  });
              }
          }
      } else { // Project without milestones
        const allTasks = project.milestones.flatMap(m => m.tasks);
        const existingProjectLevelWeight = allTasks.reduce((sum, task) => sum + task.weight, 0);
        const remainingWeight = 100 - existingProjectLevelWeight;

        if (data.weight > remainingWeight) {
             ctx.addIssue({
                  path: ['weight'],
                  message: `Total project-level task weight cannot exceed 100%. Remaining: ${remainingWeight}%.`,
              });
        }

        if (project.startDate && data.startDate < parseISO(project.startDate)) {
          ctx.addIssue({
            path: ['startDate'],
            message: `Must be on or after project start date: ${format(parseISO(project.startDate), 'MMM d')}.`
          });
        }
        if (project.endDate && data.endDate > parseISO(project.endDate)) {
          ctx.addIssue({
            path: ['endDate'],
            message: `Must be on or before project end date: ${format(parseISO(project.endDate), 'MMM d')}.`
          });
        }
      }
    });
}


export function AddTaskDialog({ isOpen, onOpenChange, project, onTaskAdd, users }: AddTaskDialogProps) {

  const { assignableUsers, hasProjectTeams } = useMemo(() => {
    const projectHasTeams = project.teams && project.teams.length > 0;
    
    if (projectHasTeams) {
        const teamMemberAndLeadIds = new Set<string>();
        project.teams.forEach(team => {
            teamMemberAndLeadIds.add(team.teamLeadId);
            team.members.forEach(member => teamMemberAndLeadIds.add(member.id));
        });
        const teamUsers = users.filter(user => teamMemberAndLeadIds.has(user.id));
        return { assignableUsers: teamUsers, hasProjectTeams: true };
    }

    const nonAdminUsers = users.filter(user => user.roles && !user.roles.some(role => role.name === 'Admin'));
    return { assignableUsers: nonAdminUsers, hasProjectTeams: false };
  }, [project, users]);
  
  const userCreatedMilestones = useMemo(() => {
    return project.milestones?.filter(m => m.title !== "General Tasks") || [];
  }, [project.milestones]);

  const hasMilestones = userCreatedMilestones.length > 0;
  
  const form = useForm<z.infer<ReturnType<typeof createTaskSchema>>>({
    resolver: zodResolver(createTaskSchema(project, hasMilestones)),
  });

  const selectedMilestoneId = form.watch('milestoneId');
  const assignedUserIds = form.watch('assignedUserIds');
  
  const selectedMilestone = useMemo(() => {
    if (!selectedMilestoneId) return null;
    return project.milestones.find(m => m.id === selectedMilestoneId);
  }, [selectedMilestoneId, project.milestones]);

  const remainingWeight = useMemo(() => {
    if (hasMilestones) {
        if (!selectedMilestone) return 0;
        const existingTasksWeight = (selectedMilestone.tasks || []).reduce((sum, task) => sum + task.weight, 0);
        return 100 - existingTasksWeight;
    }
    // No milestones case
    const allTasks = project.milestones.flatMap(m => m.tasks);
    const existingWeight = allTasks.reduce((sum, task) => sum + task.weight, 0);
    return 100 - existingWeight;
  }, [selectedMilestone, project, hasMilestones]);
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: "",
        description: "",
        startDate: new Date(),
        endDate: new Date(),
        assignedUserIds: [],
        weight: 10,
        milestoneId: hasMilestones ? undefined : "project-level",
      });
    }
  }, [isOpen, project, form, hasMilestones]);


  const selectedUsers = useMemo(() => 
    (assignableUsers || []).filter(user => assignedUserIds?.includes(user.id)),
    [assignableUsers, assignedUserIds]
  );

  async function onSubmit(data: z.infer<ReturnType<typeof createTaskSchema>>) {
    const { milestoneId, ...newTaskData } = data;
    const finalMilestoneId = hasMilestones ? milestoneId : null;
    await onTaskAdd(project.id, finalMilestoneId || null, newTaskData as any);
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
          <DialogTitle>Add New Task to "{project.name}"</DialogTitle>
          <DialogDescription>Fill in the details for the new task. The total weight of all tasks in a milestone cannot exceed 100%.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6">
            <Form {...form}>
              <form id="add-task-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                      {hasProjectTeams && <FormDescription>Showing only members from this project's teams.</FormDescription>}
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
                          {assignableUsers.map((user) => (
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
                            <FormLabel>Task Weight ({selectedMilestone ? `Remaining in milestone: ${remainingWeight}%` : `Remaining for project: ${remainingWeight}%`}): {field.value ?? 0}%</FormLabel>
                            <FormControl>
                                <Slider
                                    value={[field.value ?? 0]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                    max={remainingWeight > 0 ? remainingWeight : 100}
                                    step={5}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
              </form>
            </Form>
        </div>
        <DialogFooter className="p-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="add-task-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Adding..." : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
