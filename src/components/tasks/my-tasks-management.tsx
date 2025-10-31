
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
import type { Task, User, TaskUpdate, TaskStatus } from "@/lib/types";
import { format, formatDistanceToNow, isPast, parseISO, differenceInDays, isAfter, endOfDay } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Clock, Check, Target, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { UserTask } from "@/app/my-tasks/actions";
import { addTaskUpdateAction, updateTaskStatusAction } from "@/app/my-tasks/actions";
import { Slider } from "../ui/slider";

const taskUpdateSchema = (taskProgress: number) => z.object({
  text: z.string().min(10, "Update must be at least 10 characters.").max(500, "Update cannot exceed 500 characters."),
  progressPercentage: z.number().min(taskProgress, `Progress cannot go backward. Current is ${taskProgress}%.`).max(100, "Progress cannot exceed 100%."),
});

type TaskUpdateFormValues = z.infer<ReturnType<typeof taskUpdateSchema>>;

type MyTasksManagementProps = {
    allUsers: User[];
    currentUser: User;
    initialTasks: UserTask[];
    onDataChange: () => void;
};


const taskStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'PENDING_REVIEW', 'DONE'];
const formatStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ').toLowerCase();

const TaskItem = ({ 
    task, 
    userMap,
    onStatusChange,
    onUpdateSubmit,
}: { 
    task: UserTask; 
    userMap: Map<string, User>;
    onStatusChange: (newStatus: TaskStatus) => void;
    onUpdateSubmit: (data: TaskUpdateFormValues) => void;
}) => {
    
    const currentProgress = task.progress ?? 0;

    const form = useForm<TaskUpdateFormValues>({
        resolver: zodResolver(taskUpdateSchema(currentProgress)),
        defaultValues: { text: "", progressPercentage: currentProgress },
    });

    return (
        <Card>
            <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:border-b">
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
                                onValueChange={(newStatus: TaskStatus) => onStatusChange(newStatus)}
                                disabled={task.status === 'DONE'}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                {taskStatuses.map(status => (
                                    <SelectItem key={status} value={status} disabled={status === 'DONE'}>
                                        {formatStatus(status)}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <Badge variant="outline">Due: {format(new Date(task.endDate), 'MMM dd, yyyy')}</Badge>
                        <Badge variant="secondary">Weight: {task.weight}%</Badge>
                        <div className="flex-grow">
                            <Progress value={currentProgress} className="h-2" />
                        </div>
                        <span className="text-xs font-semibold">{currentProgress}% Complete</span>
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold mb-2">Updates</h4>
                        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                            {task.updates && task.updates.length > 0 ? (
                                task.updates.map(update => {
                                    const author = userMap.get(update.authorId);
                                    
                                    if (update.type === 'STATUS_CHANGE') {
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
                                                {update.progressPercentage !== null && (
                                                  <div className="mt-2 text-xs text-muted-foreground">
                                                    Progress reported: <span className="font-bold">{update.progressPercentage}%</span>
                                                  </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            ) : <p className="text-sm text-muted-foreground">No updates posted yet.</p>}
                        </div>
                    </div>
                    <div>
                        {task.status === 'DONE' ? (
                            <div className="text-sm text-green-700 font-medium p-3 bg-green-50 rounded-md border border-green-200 mt-4 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                This task has been completed and approved. No further updates can be made.
                            </div>
                        ) : (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit((data) => { onUpdateSubmit(data); form.reset({ text: '', progressPercentage: data.progressPercentage }); })} className="space-y-4 mt-4">
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
                                    <FormField
                                        control={form.control}
                                        name="progressPercentage"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Task Progress: {field.value}%</FormLabel>
                                                <FormControl>
                                                    <Slider
                                                        value={[field.value ?? 0]}
                                                        onValueChange={(value) => field.onChange(value[0])}
                                                        max={100}
                                                        step={5}
                                                    />
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
    );
}

const TaskSection = ({ title, icon, tasks, userMap, onStatusChange, onUpdateSubmit, expandedTaskId, setExpandedTaskId }: {
    title: string;
    icon: React.ReactNode;
    tasks: UserTask[];
    userMap: Map<string, User>;
    onStatusChange: (task: UserTask, newStatus: TaskStatus) => void;
    onUpdateSubmit: (task: UserTask, data: TaskUpdateFormValues) => void;
    expandedTaskId: string | null;
    setExpandedTaskId: (id: string | null) => void;
}) => (
    <Card>
        <CardHeader className="flex flex-row items-center gap-4">
            {icon}
            <CardTitle>{title} ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
             <Accordion type="single" collapsible className="w-full" value={expandedTaskId || ""} onValueChange={(value) => setExpandedTaskId(value || null)}>
                {tasks.length > 0 ? (
                    tasks.map(task => (
                        <AccordionItem value={task.id} key={task.id} className="border-b-0">
                            <TaskItem 
                                task={task}
                                userMap={userMap}
                                onStatusChange={(newStatus) => onStatusChange(task, newStatus)}
                                onUpdateSubmit={(data) => onUpdateSubmit(task, data)}
                            />
                        </AccordionItem>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground pl-4">No tasks in this category.</p>
                )}
             </Accordion>
        </CardContent>
    </Card>
)

export function MyTasksManagement({ allUsers, currentUser, initialTasks, onDataChange }: MyTasksManagementProps) {
  const { toast } = useToast();
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const { overdueTasks, activeTasks, accomplishedThisWeek, onTimePerformance, completedTasksCount } = useMemo(() => {
    const overdue: UserTask[] = [];
    const active: UserTask[] = [];
    const accomplished: UserTask[] = [];
    
    const allCompletedTasks = initialTasks.filter(t => t.status === 'DONE');

    initialTasks.forEach(task => {
        const isTaskOverdue = isAfter(new Date(), endOfDay(parseISO(task.endDate))) && task.status !== 'DONE';
        if (isTaskOverdue) {
            overdue.push(task);
        } else if (task.status === 'DONE') {
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

    const onTimeCount = allCompletedTasks.filter(t => 
        t.completedAt && parseISO(t.completedAt) <= parseISO(t.endDate)
    ).length;
    
    const performance = allCompletedTasks.length > 0 
        ? (onTimeCount / allCompletedTasks.length) * 100 
        : 0;

    return { 
        overdueTasks: overdue, 
        activeTasks: active, 
        accomplishedThisWeek: accomplished,
        onTimePerformance: performance,
        completedTasksCount: allCompletedTasks.length,
    };
  }, [initialTasks]);


  const handleStatusChange = async (task: UserTask, newStatus: TaskStatus) => {
    const result = await updateTaskStatusAction(task.id, newStatus);
    if (result.success) {
        toast({
            title: "Status Updated",
            description: `Task status has been changed to "${formatStatus(newStatus)}".`
        });
        onDataChange();
    } else {
        toast({
            title: "Error",
            description: result.error,
            variant: "destructive"
        });
    }
  };

  const handleUpdateSubmit = async (task: UserTask, data: TaskUpdateFormValues) => {
    if (data.progressPercentage === task.progress) {
      toast({
        title: "No Progress Change",
        description: "Please update the progress slider before posting an update.",
        variant: "destructive",
      });
      return;
    }
    const result = await addTaskUpdateAction(task.id, data.text, currentUser.id, data.progressPercentage);
    let toastDescription = "Your progress update has been recorded.";

    if (result.success) {
        if (task.status === 'TODO' || task.status === 'IN_PROGRESS') {
             toastDescription = "Your update has been posted and the task is now pending review.";
        }
        toast({
            title: "Update Added",
            description: toastDescription
        });
        onDataChange();
    } else {
        toast({
            title: "Error",
            description: result.error,
            variant: "destructive"
        });
    }
  };

  const handleSetExpanded = (id: string | null) => {
    setExpandedTaskId(prevId => prevId === id ? null : id);
  }

  const commonTaskSectionProps = {
    userMap,
    onStatusChange: handleStatusChange,
    onUpdateSubmit: handleUpdateSubmit,
    expandedTaskId,
    setExpandedTaskId: handleSetExpanded,
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
              <div className="text-2xl font-bold">
                 {completedTasksCount > 0 ? `${Math.round(onTimePerformance)}%` : 'N/A'}
              </div>
              <Progress value={onTimePerformance} className="h-2 mt-2" />
               <p className="text-xs text-muted-foreground">
                  {completedTasksCount > 0 ? 'Based on all completed tasks' : 'No tasks completed yet'}
               </p>
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
