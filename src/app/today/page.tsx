
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { getTodaysTasks } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Task, User } from '@prisma/client';
import { Calendar, Edit, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { isToday, parseISO, startOfDay } from 'date-fns';

type TaskWithAssigneesAndUpdates = Task & { 
    assignees: User[],
    updates: { createdAt: string }[]
};
type ProjectWithTasks = {
  id: string;
  name: string;
  tasks: TaskWithAssigneesAndUpdates[];
};

function LoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

const TaskItem = ({ task }: { task: TaskWithAssigneesAndUpdates }) => (
    <div className="p-4 border rounded-md bg-muted/50">
        <div className="flex justify-between items-start">
            <h4 className="font-semibold">{task.title}</h4>
            <div className="flex -space-x-2">
                <TooltipProvider>
                    {task.assignees.map(assignee => (
                        <Tooltip key={assignee.id}>
                            <TooltipTrigger>
                                <Avatar className="h-8 w-8 border-2 border-background">
                                    <AvatarImage src={assignee.avatar || undefined} />
                                    <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{assignee.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </TooltipProvider>
            </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
        <div className="flex items-center gap-4 mt-2">
            <Progress value={task.progress || 0} className="flex-1 h-2" />
            <span className="text-xs font-semibold">{task.progress || 0}%</span>
        </div>
    </div>
);

const TaskSection = ({ title, icon, tasks }: { title: string, icon: React.ReactNode, tasks: TaskWithAssigneesAndUpdates[] }) => {
    if (tasks.length === 0) return null;

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h3 className="font-semibold text-muted-foreground">{title}</h3>
            </div>
            <div className="space-y-4">
                {tasks.map(task => <TaskItem key={task.id} task={task} />)}
            </div>
        </div>
    )
}

export default function TodayPage() {
  const { hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTodaysTasks();
      setProjects(data);
    } catch (error) {
      console.error("Failed to fetch today's tasks", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('dashboard:view')) {
        router.replace('/dashboard');
      } else {
        fetchData();
      }
    }
  }, [authLoading, hasPermission, router, fetchData]);

  if (isLoading || authLoading) {
    return <LoadingSkeleton />;
  }

  const projectsWithActivity = projects.filter(project => {
      const todayStart = startOfDay(new Date());
      const hasRelevantTask = project.tasks.some(task => {
        const startDate = parseISO(task.startDate.toString());
        const endDate = parseISO(task.endDate.toString());
        const isScheduledToday = todayStart >= startDate && todayStart <= endDate;
        const isDueToday = isToday(parseISO(task.endDate.toString()));
        const wasUpdatedToday = task.updates?.some(u => isToday(parseISO(u.createdAt)));
        return isScheduledToday || isDueToday || wasUpdatedToday;
      });
      return hasRelevantTask;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Today's Activity</CardTitle>
          <CardDescription>
            A snapshot of all activity happening today across all projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {projectsWithActivity.length > 0 ? (
                <Accordion type="multiple" className="w-full space-y-4" defaultValue={projectsWithActivity.map(p => p.id)}>
                    {projectsWithActivity.map(project => {
                        const todayStart = startOfDay(new Date());
                        
                        const scheduledToday = project.tasks.filter(t => {
                            const startDate = parseISO(t.startDate.toString());
                            const endDate = parseISO(t.endDate.toString());
                            return todayStart >= startDate && todayStart <= endDate;
                        });

                        const dueToday = project.tasks.filter(t => isToday(parseISO(t.endDate.toString())));
                        
                        const updatedToday = project.tasks.filter(t => t.updates?.some(u => isToday(parseISO(u.createdAt))));

                        const hasAnyTasks = scheduledToday.length > 0 || dueToday.length > 0 || updatedToday.length > 0;

                        if (!hasAnyTasks) {
                            return null;
                        }

                        return (
                            <AccordionItem value={project.id} key={project.id} className="border rounded-lg">
                                <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
                                    {project.name}
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
                                    <div className="space-y-6">
                                        <TaskSection 
                                            title="Scheduled Today"
                                            icon={<Calendar className="h-5 w-5 text-blue-500" />}
                                            tasks={scheduledToday}
                                        />
                                        
                                        {dueToday.length > 0 && scheduledToday.length > 0 && <Separator />}
                                        
                                        <TaskSection 
                                            title="Due Today"
                                            icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
                                            tasks={dueToday}
                                        />

                                        {updatedToday.length > 0 && (dueToday.length > 0 || scheduledToday.length > 0) && <Separator />}

                                        <TaskSection 
                                            title="Updated Today"
                                            icon={<Edit className="h-5 w-5 text-orange-500" />}
                                            tasks={updatedToday}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            ) : (
                 <div className="text-center py-12 text-muted-foreground">
                    <p>No tasks are active or were updated today. Enjoy the calm!</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
