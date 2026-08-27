
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
import type { Task, User, TaskUpdate, TaskStatus, UserSummary } from "@/lib/types";
import { format, formatDistanceToNow, isPast, parseISO, differenceInDays, isAfter, endOfDay, isToday } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Clock, Check, Target, Award, CalendarCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { UserTask } from "@/app/my-tasks/actions";
import { addTaskUpdateAction, updateTaskStatusAction } from "@/app/my-tasks/actions";
import { Slider } from "../ui/slider";
import { cn } from "@/lib/utils";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { TaskStatusPill } from "@/components/ui/status-pill";
import { TaskWorkspace } from "./my-tasks-views";
import type { TaskLike } from "./task-views";

const taskUpdateSchema = (taskProgress: number) => z.object({
  text: z.string().min(10, "Update must be at least 10 characters.").max(500, "Update cannot exceed 500 characters."),
  progressPercentage: z.number().min(taskProgress, `Progress cannot go backward. Current is ${taskProgress}%.`).max(100, "Progress cannot exceed 100%."),
});

type TaskUpdateFormValues = z.infer<ReturnType<typeof taskUpdateSchema>>;

type MyTasksManagementProps = {
    allUsers: UserSummary[];
    currentUser: User;
    initialTasks: UserTask[];
    onDataChange: () => void;
    todaysTasksCount: number;
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
    userMap: Map<string, UserSummary>;
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
                <div className="flex flex-1 flex-col gap-3 pr-2 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{task.title}</span>
                            {/* The same status pill used on the task page, the
                                project page and the review queue, rather than a
                                fourth rendering of the same four values. */}
                            <TaskStatusPill status={task.status} />
                        </div>
                        <p className="text-sm font-normal text-muted-foreground">
                            {task.projectName} / {task.milestoneTitle}
                        </p>
                    </div>
                    <div className="flex w-full items-center gap-3 sm:w-40 sm:shrink-0">
                        <Progress
                            value={currentProgress}
                            className="h-2 flex-1"
                            aria-label={`${task.title}: ${currentProgress}% complete`}
                        />
                        <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">
                            {currentProgress}%
                        </span>
                    </div>
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
                    {/* Progress moved to the row header, where it can be read
                        without expanding the task. Repeating it here was the
                        same bar twice on one screen. */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline">Due {format(new Date(task.endDate), 'd MMM yyyy')}</Badge>
                        <Badge variant="secondary">Weight {task.weight}%</Badge>
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
                                                        <CheckCircle className="w-6 h-6 text-success" />
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
                                                <AvatarImage src={author?.avatar ?? undefined} alt={author?.name} />
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
                            <div className="text-sm text-success-strong font-medium p-3 bg-success-soft rounded-md border border-success/30 mt-4">
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

const TaskSection = ({ title, icon, tasks, userMap, onStatusChange, onUpdateSubmit, expandedTaskId, setExpandedTaskId, show, emptyMatters, searching }: {
    title: string;
    icon: React.ReactNode;
    tasks: UserTask[];
    userMap: Map<string, UserSummary>;
    onStatusChange: (task: UserTask, newStatus: TaskStatus) => void;
    onUpdateSubmit: (task: UserTask, data: TaskUpdateFormValues) => void;
    expandedTaskId: string | null;
    setExpandedTaskId: (id: string | null) => void;
    show: boolean;
    /** True when this section is the only one showing, so empty must be said. */
    emptyMatters?: boolean;
    searching?: boolean;
}) => {
    if (!show) return null;

    // A section with nothing in it is not worth a card of its own while the
    // unfiltered view is showing every section at once — four headings over
    // four "no tasks in this category" lines is noise, not information.
    if (tasks.length === 0 && !emptyMatters) return null;

    return (
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
                        <EmptyState
                            variant={searching ? 'no-match' : 'none-yours'}
                            title={searching ? 'Nothing here matches your search' : `Nothing ${title.toLowerCase()}`}
                            compact
                        />
                    )}
                </Accordion>
            </CardContent>
        </Card>
    )
}

export function MyTasksManagement({ allUsers, currentUser, initialTasks, onDataChange, todaysTasksCount }: MyTasksManagementProps) {
  const { toast } = useToast();
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'overdue' | 'active' | 'accomplished' | 'today' | null>(null);
  const [search, setSearch] = useState('');

  const { overdueTasks, activeTasks, accomplishedThisWeek, onTimePerformance, completedTasksCount, todaysTasks } = useMemo(() => {
    const overdue: UserTask[] = [];
    const active: UserTask[] = [];
    const accomplished: UserTask[] = [];
    const today: UserTask[] = [];
    
    const allCompletedTasks = initialTasks.filter(t => t.status === 'DONE');

    initialTasks.forEach(task => {
        const isTaskOverdue = isAfter(new Date(), endOfDay(parseISO(task.endDate))) && task.status !== 'DONE';
        const isTaskForToday = task.status !== 'DONE' && isToday(parseISO(task.endDate));
        
        if (isTaskForToday) {
            today.push(task);
        }

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
    today.sort((a,b) => parseISO(a.endDate).getTime() - parseISO(b.endDate).getTime());

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
        todaysTasks: today,
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

  const handleFilterClick = (newFilter: 'overdue' | 'active' | 'accomplished' | 'today' | null) => {
      setFilter(currentFilter => currentFilter === newFilter ? null : newFilter);
  }

  /**
   * Searching narrows every section at once.
   *
   * Deliberately applied after the sections are worked out rather than before:
   * a search that emptied the "Overdue" bucket would otherwise make the count
   * on the card change too, and the cards are meant to report the standing
   * position, not the search result.
   */
  const query = search.trim().toLowerCase();
  const narrow = (tasks: UserTask[]) =>
    query
      ? tasks.filter(
          (t) =>
            String(t.title ?? '').toLowerCase().includes(query) ||
            String(t.projectName ?? '').toLowerCase().includes(query) ||
            String(t.milestoneTitle ?? '').toLowerCase().includes(query),
        )
      : tasks;

  /**
   * The tasks in the shape the workspace reads.
   *
   * Mapped rather than passed through: the workspace is shared with Team view,
   * whose rows come from a different query, and giving both the same shape is
   * what keeps the two screens agreeing about what "overdue" means.
   */
  const workspaceTasks: TaskLike[] = useMemo(
    () =>
      initialTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        endDate: task.endDate as unknown as string,
        progress: task.progress ?? 0,
        projectId: task.projectId,
        projectName: task.projectName,
        milestoneTitle: task.milestoneTitle,
      })),
    [initialTasks],
  );

  return (
    <PageShell>
      <PageHeader
        title="My tasks"
        description="Everything assigned to you, what is late, and how you are tracking."
      />

      <StatCardGrid columns={4} className="xl:grid-cols-5">
        <StatCard
          label="Overdue"
          icon={AlertTriangle}
          tone={overdueTasks.length > 0 ? 'critical' : 'positive'}
          value={overdueTasks.length}
          hint="past their due date"
          onClick={() => handleFilterClick('overdue')}
          selected={filter === 'overdue'}
        />
        <StatCard
          label="Due today"
          icon={CalendarCheck}
          tone={todaysTasksCount > 0 ? 'warning' : 'neutral'}
          value={todaysTasksCount}
          hint="due by end of day"
          onClick={() => handleFilterClick('today')}
          selected={filter === 'today'}
        />
        <StatCard
          label="Active"
          icon={Clock}
          value={activeTasks.length}
          hint="upcoming or in progress"
          onClick={() => handleFilterClick('active')}
          selected={filter === 'active'}
        />
        <StatCard
          label="Done this week"
          icon={Award}
          tone="positive"
          value={accomplishedThisWeek.length}
          hint="completed in the last 7 days"
          onClick={() => handleFilterClick('accomplished')}
          selected={filter === 'accomplished'}
        />
        <StatCard
          label="On-time performance"
          icon={Target}
          value={completedTasksCount > 0 ? `${Math.round(onTimePerformance)}%` : 'N/A'}
          progress={completedTasksCount > 0 ? onTimePerformance : undefined}
          hint={
            completedTasksCount > 0
              ? `across ${completedTasksCount} completed task${completedTasksCount === 1 ? '' : 's'}`
              : 'nothing completed yet'
          }
          interactive={false}
        />
      </StatCardGrid>

      {/*
        The four fixed sections this replaces — Overdue, Due today, Active,
        Accomplished — were the only arrangement on offer, so a question the
        sections did not answer could not be asked. The workspace keeps the
        same tasks and lets the reader choose the shape: a list when hunting
        for what is late, a board when asking where work is piling up, a
        calendar when planning a week.
      */}
      <TaskWorkspace
        tasks={workspaceTasks}
        onDataChange={onDataChange}
        storageKey="my-tasks"
        emptyTitle="No tasks are assigned to you"
        emptyDescription="When somebody assigns you work it will appear here."
      />
    </PageShell>
  );
}
