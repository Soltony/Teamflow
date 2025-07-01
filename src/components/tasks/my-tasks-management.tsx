
"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Task, User, TaskUpdate } from "@/lib/types";
import { format, formatDistanceToNow, isPast, parseISO, differenceInDays } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Clock, Check, Target, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { UserTask } from "@/app/my-tasks/page";
import { addTaskUpdateAction, updateTaskStatusAction } from "@/app/my-tasks/actions";

type MyTasksManagementProps = {
  allUsers: User[];
  currentUser: User;
  initialTasks: UserTask[];
};

const taskUpdateSchema = z.object({
  text: z.string().min(10, "Update must be at least 10 characters.").max(500, "Update cannot exceed 500 characters."),
});

type TaskUpdateFormValues = z.infer<typeof taskUpdateSchema>;

const taskStatuses: Task['status'][] = ['todo', 'in-progress', 'pending-review', 'done'];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TaskItem = ({ 
    task, 
    userMap,
    onStatusChange,
    onUpdateSubmit,
}: { 
    task: UserTask; 
    userMap: Map<string, User>;
    onStatusChange: (newStatus: Task['status']) => void;
    onUpdateSubmit: (data: TaskUpdateFormValues) => void;
}) => {
    const form = useForm<TaskUpdateFormValues>({
        resolver: zodResolver(taskUpdateSchema),
        defaultValues: { text: "" },
    });

    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value={task.id} className="border-b-0">
                <Card>
                    <AccordionTrigger className="p-4 hover:no-underline">
                        <div className="flex-1 text-left">
                            <p className="font-semibold">{task.title}</p>
                            <p className="text-sm text-muted-foreground">
                                In Project: {task.projectName} / {task.milestoneTitle}
                            </p>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <div className="w-48">
                                    <Select 
                                        value={task.status} 
                                        onValueChange={(newStatus: Task['status']) => onStatusChange(newStatus)}
                                        disabled={task.status === 'done'}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                        {taskStatuses.map(status => (
                                            <SelectItem key={status} value={status} disabled={status === 'done'}>
                                                {capitalize(status.replace('-', ' '))}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                            <div className="flex flex-wrap gap-4 text-sm">
                                <Badge variant="outline">Due: {format(new Date(task.endDate), 'MMM dd, yyyy')}</Badge>
                                <Badge variant="secondary">Weight: {task.weight}%</Badge>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="font-semibold mb-2">Updates</h4>
                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                                    {task.updates && task.updates.length > 0 ? (
                                        task.updates.slice().reverse().map(update => {
                                            const author = userMap.get(update.authorId);
                                            
                                            if (update.type === 'status-change') {
                                                const isApproval = update.text.includes('approved');
                                                return (
                                                    <div key={update.id} className="flex items-start gap-3">
                                                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                                            {isApproval ? (
                                                                <CheckCircle className="w-6 h-6 text-green-500" />
                                                            ) : (
                                                                <XCircle className="w-6 h-6 text-destructive" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-semibold">{isApproval ? 'Task Approved' : 'Task Declined'}</span>
                                                                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</span>
                                                            </div>
                                                            <p className="text-muted-foreground italic">{update.text}</p>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={update.id} className="flex items-start gap-3">
                                                    <Avatar className="w-8 h-8 border">
                                                        <AvatarImage src={author?.avatar} alt={author?.name} />
                                                        <AvatarFallback>{author?.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="font-semibold">{author?.name}</span>
                                                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</span>
                                                        </div>
                                                        <p>{update.text}</p>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : <p className="text-sm text-muted-foreground">No updates posted yet.</p>}
                                </div>
                            </div>
                            <div>
                                {task.status === 'done' ? (
                                    <div className="text-sm text-green-700 font-medium p-3 bg-green-50 rounded-md border border-green-200 mt-4 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                        This task has been completed and approved. No further updates can be made.
                                    </div>
                                ) : (
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit((data) => { onUpdateSubmit(data); form.reset(); })} className="space-y-2 mt-4">
                                            <FormField
                                            control={form.control}
                                            name="text"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="sr-only">Add Update</FormLabel>
                                                    <FormControl>
                                                        <Textarea placeholder="Post a new update..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                            />
                                            <Button type="submit" size="sm">Post Update</Button>
                                        </form>
                                    </Form>
                                )}
                            </div>
                        </div>
                    </AccordionContent>
                </Card>
            </AccordionItem>
        </Accordion>
    );
}

const TaskSection = ({ title, icon, tasks, userMap, onStatusChange, onUpdateSubmit }: {
    title: string;
    icon: React.ReactNode;
    tasks: UserTask[];
    userMap: Map<string, User>;
    onStatusChange: (task: UserTask, newStatus: Task['status']) => void;
    onUpdateSubmit: (task: UserTask, data: TaskUpdateFormValues) => void;
}) => (
    <Card>
        <CardHeader className="flex flex-row items-center gap-4">
            {icon}
            <CardTitle>{title} ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            {tasks.length > 0 ? (
                tasks.map(task => (
                    <TaskItem 
                        key={task.id}
                        task={task}
                        userMap={userMap}
                        onStatusChange={(newStatus) => onStatusChange(task, newStatus)}
                        onUpdateSubmit={(data) => onUpdateSubmit(task, data)}
                    />
                ))
            ) : (
                <p className="text-sm text-muted-foreground pl-4">No tasks in this category.</p>
            )}
        </CardContent>
    </Card>
)

export function MyTasksManagement({ allUsers, currentUser, initialTasks }: MyTasksManagementProps) {
  const { toast } = useToast();
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

  const { overdueTasks, activeTasks, accomplishedThisWeek, onTimePerformance } = useMemo(() => {
    const overdue: UserTask[] = [];
    const active: UserTask[] = [];
    const accomplished: UserTask[] = [];

    initialTasks.forEach(task => {
        const isTaskOverdue = isPast(parseISO(task.endDate)) && task.status !== 'done';
        if (isTaskOverdue) {
            overdue.push(task);
        } else if (task.status === 'done') {
            if (task.completedAt && differenceInDays(new Date(), parseISO(task.completedAt)) <= 7) {
                accomplished.push(task);
            }
        } else {
            active.push(task);
        }
    });
    
    overdue.sort((a,b) => parseISO(a.endDate).getTime() - parseISO(b.endDate).getTime());
    active.sort((a,b) => parseISO(a.endDate).getTime() - parseISO(b.endDate).getTime());
    accomplished.sort((a,b) => parseISO(b.completedAt!).getTime() - parseISO(a.completedAt!).getTime());

    const allCompletedTasks = initialTasks.filter(t => t.status === 'done' && t.completedAt);
    const onTimeCount = allCompletedTasks.filter(t => 
        t.completedAt && parseISO(t.completedAt) <= parseISO(t.endDate)
    ).length;
    
    const performance = allCompletedTasks.length > 0 
        ? (onTimeCount / allCompletedTasks.length) * 100 
        : 100;

    return { 
        overdueTasks: overdue, 
        activeTasks: active, 
        accomplishedThisWeek: accomplished,
        onTimePerformance: performance,
    };
  }, [initialTasks]);


  const handleStatusChange = async (task: UserTask, newStatus: Task['status']) => {
    const result = await updateTaskStatusAction(task.id, newStatus);
    if (result.success) {
        toast({
            title: "Status Updated",
            description: `Task status has been changed to "${capitalize(newStatus.replace('-', ' '))}".`
        });
    } else {
        toast({
            title: "Error",
            description: result.error,
            variant: "destructive"
        });
    }
  };

  const handleUpdateSubmit = async (task: UserTask, data: TaskUpdateFormValues) => {
    const result = await addTaskUpdateAction(task.id, data.text, currentUser.id);
    let toastDescription = "Your progress update has been recorded.";

    if (result.success) {
        if (task.status === 'in-progress') {
            toastDescription = "Your update has been posted and the task is resubmitted for review.";
        }
        toast({
            title: "Update Added",
            description: toastDescription
        });
    } else {
        toast({
            title: "Error",
            description: result.error,
            variant: "destructive"
        });
    }
  };

  const commonTaskSectionProps = {
    userMap,
    onStatusChange: handleStatusChange,
    onUpdateSubmit: handleUpdateSubmit
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <p className="text-muted-foreground">
          Your personal dashboard for managing all assigned tasks and tracking performance.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overdueTasks.length}</div>
              <p className="text-xs text-muted-foreground">Tasks past their due date</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeTasks.length}</div>
              <p className="text-xs text-muted-foreground">Upcoming or in-progress tasks</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accomplished (Week)</CardTitle>
              <Award className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accomplishedThisWeek.length}</div>
               <p className="text-xs text-muted-foreground">Tasks completed in the last 7 days</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Performance</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(onTimePerformance)}%</div>
              <Progress value={onTimePerformance} className="h-2 mt-2" />
            </CardContent>
        </Card>
      </div>

      {overdueTasks.length === 0 && activeTasks.length === 0 && accomplishedThisWeek.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-semibold">No tasks assigned to you!</p>
            <p>Your task list is empty. Enjoy the peace and quiet.</p>
        </div>
      )}

      {overdueTasks.length > 0 &&
        <TaskSection 
            title="Overdue"
            icon={<AlertTriangle className="w-6 h-6 text-destructive" />}
            tasks={overdueTasks}
            {...commonTaskSectionProps}
        />
      }
      {activeTasks.length > 0 &&
        <TaskSection 
            title="Active"
            icon={<Clock className="w-6 h-6 text-blue-500" />}
            tasks={activeTasks}
            {...commonTaskSectionProps}
        />
      }
      {accomplishedThisWeek.length > 0 && 
        <TaskSection 
            title="Accomplished This Week"
            icon={<Check className="w-6 h-6 text-green-500" />}
            tasks={accomplishedThisWeek}
            {...commonTaskSectionProps}
        />
      }
    </div>
  );
}
