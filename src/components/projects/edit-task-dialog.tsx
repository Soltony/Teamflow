

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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { Milestone, Project, Task, User, TaskStatus, Team, UserWithRoles } from "@/lib/types";
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

const taskStatuses = ['TODO', 'IN_PROGRESS', 'PENDING_REVIEW', 'DONE'] as const satisfies readonly TaskStatus[];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const formatStatus = (s: string) => capitalize(s.replace(/_/g, ' ').toLowerCase());

type ProjectWithTeamsAndMilestones = Project & { 
    teams: (Team & { members: User[], teamLead: User })[];
    milestones: (Milestone & {tasks: Task[]})[]; 
};


type EditTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithTeamsAndMilestones;
  task: Task;
  users: UserWithRoles[];
  onTaskUpdate: (updatedTask: Task) => Promise<void>;
};

function createTaskSchema(project: ProjectWithTeamsAndMilestones, task: Task, hasMilestones: boolean) {
  return z.object({
    title: z.string().min(3, "Task title must be at least 3 characters."),
    description: z.string().optional(),
    startDate: z.date({ required_error: "A start date is required."}),
    endDate: z.date({ required_error: "An end date is required."}),
    assignedUserIds: z.array(z.string()).min(1, { message: "At least one user must be assigned." }),
    weight: z.number().min(0, "Weight must be a positive number.").max(100, "Weight cannot exceed 100."),
    status: z.enum(taskStatuses),
    milestoneId: z.string().optional(),
  }).refine(data => data.endDate >= data.startDate, {
      message: "End date must be on or after start date.",
      path: ["endDate"],
  }).superRefine((data, ctx) => {
    
    if (hasMilestones) {
        if (!data.milestoneId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['milestoneId'],
                message: 'A milestone must be selected for this project.'
            });
            return;
        }

        const selectedMilestone = project.milestones.find(m => m.id === data.milestoneId);
        if (selectedMilestone) {
            const otherTasksWeight = (selectedMilestone.tasks || [])
                .filter(t => t.id !== task.id)
                .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);
            
            const maxWeightForThisTask = Math.max(0, 100 - otherTasksWeight);

            if (data.weight > maxWeightForThisTask + 1e-6) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["weight"],
                    message: `Weight exceeds remaining ${maxWeightForThisTask}% for milestone tasks.`,
                });
            }

            if (selectedMilestone.startDate && data.startDate < parseISO(selectedMilestone.startDate)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['startDate'],
                    message: `Must be on or after milestone start: ${format(parseISO(selectedMilestone.startDate), 'MMM d')}.`
                });
            }
            if (selectedMilestone.dueDate && data.endDate > parseISO(selectedMilestone.dueDate)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['endDate'],
                    message: `Must be on or before milestone due date: ${format(parseISO(selectedMilestone.dueDate), 'MMM d')}.`
                });
            }
        }
    } else { // Project-level task validation
        const projectLevelTasks = project.milestones.flatMap(m => m.tasks.filter(t => t.milestoneId === null || project.milestones.find(milestone => milestone.id === t.milestoneId)?.title === "General Tasks"));
        const otherProjectLevelTasksWeight = projectLevelTasks
            .filter(t => t.id !== task.id)
            .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);

        const remainingForProject = Math.max(0, 100 - otherProjectLevelTasksWeight);

        if (data.weight > remainingForProject + 1e-6) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["weight"],
                message: `Weight for all project-level tasks cannot exceed 100%. Remaining: ${remainingForProject}%.`,
            });
        }
    }
  });
}

export function EditTaskDialog({ isOpen, onOpenChange, project, task, users, onTaskUpdate }: EditTaskDialogProps) {
  const userCreatedMilestones = useMemo(() => {
    return (project.milestones || []).filter(m => m.title !== "General Tasks");
  }, [project.milestones]);
  
  const hasMilestones = userCreatedMilestones.length > 0;
  
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

  const form = useForm<z.infer<ReturnType<typeof createTaskSchema>>>({
    resolver: zodResolver(createTaskSchema(project, task, hasMilestones)),
  });
  
  useEffect(() => {
    if (isOpen && task) {
        const assigneeIds: string[] = task.assignedUserIds || (task as any).assignees?.map((a: any) => a.id) || [];
        
        const isGeneralMilestone = project.milestones.find(m => m.id === task.milestoneId)?.title === "General Tasks";
        const initialMilestoneId = hasMilestones && !isGeneralMilestone ? task.milestoneId ?? undefined : undefined;
      
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
  }, [isOpen, task, form, hasMilestones, project.milestones]);
  
  const selectedMilestoneId = form.watch('milestoneId');
  const assignedUserIds = form.watch('assignedUserIds');
  
  const selectedMilestone = useMemo(() => {
    if (!selectedMilestoneId) return null;
    return project.milestones.find(m => m.id === selectedMilestoneId);
  }, [selectedMilestoneId, project.milestones]);

  const maxWeightForThisTask = useMemo(() => {
    if (hasMilestones) {
        if (!selectedMilestone) return 0;
        const otherTasksWeight = (selectedMilestone.tasks || [])
            .filter((t) => t.id !== task.id)
            .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);
        return Math.max(0, 100 - otherTasksWeight);
    }
    
    const projectLevelTasks = project.milestones.flatMap(m => m.tasks.filter(t => t.milestoneId === null || project.milestones.find(milestone => milestone.id === t.milestoneId)?.title === "General Tasks"));
    const otherProjectLevelTasksWeight = projectLevelTasks
        .filter((t) => t.id !== task.id)
        .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);
    return Math.max(0, 100 - otherProjectLevelTasksWeight);
    
  }, [selectedMilestone, project.milestones, task.id, hasMilestones]);


  const selectedUsers = useMemo(() => 
    (assignableUsers || []).filter(user => assignedUserIds?.includes(user.id)),
    [assignableUsers, assignedUserIds]
  );
  
  async function onSubmit(data: z.infer<ReturnType<typeof createTaskSchema>>) {
    const updatedTask = {
      ...task,
      ...data,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate.toISOString(),
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
          <DialogTitle>Edit Task "{task.title}"</DialogTitle>
          <DialogDescription>
            Modify details and reassign members if needed.
            {(!task.assignedUserIds || task.assignedUserIds.length === 0) && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  ⚠️ This task currently has no assigned members. Please assign at least one member before saving.
                </p>
              </div>
            )}
          </DialogDescription>
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
                      <FormLabel>Assigned Members</FormLabel>
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
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Task Weight (Max: {maxWeightForThisTask}%): {field.value || 0}%</FormLabel>
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
