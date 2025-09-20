
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
import { Badge } from '@/components/ui/badge';
import { isToday, parseISO, startOfDay } from 'date-fns';
import { Calendar, Clock, Edit3, CheckCircle } from 'lucide-react';

type TaskWithAssigneesAndUpdates = Task & { 
    assignees: User[],
    updates: {createdAt: string, progressPercentage: number | null}[],
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

const TaskItem = ({ task }: { task: TaskWithAssigneesAndUpdates }) => {
    const isScheduledToday = isToday(parseISO(task.startDate as unknown as string));
    const isDueToday = isToday(parseISO(task.endDate as unknown as string));
    const wasCompletedToday = task.completedAt && isToday(parseISO(task.completedAt as unknown as string));
    
    const todaysUpdates = useMemo(() => 
        (task.updates || [])
            .map(u => ({...u, createdAt: parseISO(u.createdAt)}))
            .filter(update => isToday(update.createdAt))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    , [task.updates]);

    const wasUpdatedToday = !wasCompletedToday && todaysUpdates.length > 0;

    const progressText = useMemo(() => {
        if (wasCompletedToday) {
            const lastUpdateBeforeCompletion = (task.updates || [])
                .map(u => ({...u, createdAt: parseISO(u.createdAt)}))
                .filter(u => u.createdAt < parseISO(task.completedAt as string))
                .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
            const previousProgress = lastUpdateBeforeCompletion?.progressPercentage ?? 0;
            return `Progress: ${previousProgress}% → 100%`;
        }
        if (wasUpdatedToday) {
            const firstUpdateToday = todaysUpdates[0];
            const updatesBeforeToday = (task.updates || [])
                .map(u => ({...u, createdAt: parseISO(u.createdAt)}))
                .filter(u => u.createdAt < firstUpdateToday.createdAt)
                .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
            
            const previousProgress = updatesBeforeToday[0]?.progressPercentage ?? 0;
            return `Progress: ${previousProgress}% → ${task.progress || 0}%`;
        }
        return `${task.progress || 0}%`;
    }, [task, wasCompletedToday, wasUpdatedToday, todaysUpdates]);


    return (
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
                <span className="text-xs font-semibold">{progressText}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
                {isScheduledToday && (
                    <Badge className="flex items-center gap-1.5 text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
                        <Calendar className="w-3 h-3" /> Scheduled Today
                    </Badge>
                )}
                {isDueToday && (
                    <Badge className="flex items-center gap-1.5 text-xs bg-red-100 text-red-800 border-red-200 hover:bg-red-200">
                        <Clock className="w-3 h-3" /> Due Today
                    </Badge>
                )}
                {wasUpdatedToday && (
                     <Badge className="flex items-center gap-1.5 text-xs bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200">
                        <Edit3 className="w-3 h-3" /> Updated Today
                    </Badge>
                )}
                {wasCompletedToday && (
                     <Badge className="flex items-center gap-1.5 text-xs bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
                        <CheckCircle className="w-3 h-3" /> Completed Today
                    </Badge>
                )}
            </div>
        </div>
    );
};


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
  
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Today's Activity</CardTitle>
          <CardDescription>
            A snapshot of all activity happening today across all projects. This includes tasks that are scheduled, due, or have been updated today.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {projects.length > 0 ? (
                <Accordion type="multiple" className="w-full space-y-4">
                    {projects.map(project => (
                        <AccordionItem value={project.id} key={project.id} className="border rounded-lg">
                            <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
                                {project.name}
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                <div className="space-y-4">
                                  {project.tasks.length > 0 ? (
                                    project.tasks.map(task => <TaskItem key={task.id} task={task as TaskWithAssigneesAndUpdates} />)
                                  ) : (
                                    <p className="text-sm text-center text-muted-foreground py-4">No activity recorded for this project today.</p>
                                  )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
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

