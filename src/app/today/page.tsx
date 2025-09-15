
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
import { CheckCircle2, CircleDot } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type TaskWithAssignees = Task & { assignees: User[] };
type ProjectWithTasks = {
  id: string;
  name: string;
  tasks: TaskWithAssignees[];
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

const TaskItem = ({ task }: { task: TaskWithAssignees }) => (
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
            A snapshot of all tasks that are active or were completed today across all projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {projects.length > 0 ? (
                <Accordion type="multiple" className="w-full space-y-4" defaultValue={projects.map(p => p.id)}>
                    {projects.map(project => {
                        const activeTasks = project.tasks.filter(t => t.status !== 'DONE');
                        const completedTasks = project.tasks.filter(t => t.status === 'DONE');

                        return (
                            <AccordionItem value={project.id} key={project.id} className="border rounded-lg">
                                <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
                                    {project.name}
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
                                    <div className="space-y-6">
                                        {activeTasks.length > 0 && (
                                            <div>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <CircleDot className="h-5 w-5 text-blue-500" />
                                                    <h3 className="font-semibold text-muted-foreground">Active Tasks</h3>
                                                </div>
                                                <div className="space-y-4">
                                                    {activeTasks.map(task => <TaskItem key={task.id} task={task} />)}
                                                </div>
                                            </div>
                                        )}

                                        {completedTasks.length > 0 && (
                                            <div>
                                                 {activeTasks.length > 0 && <Separator className="my-6" />}
                                                <div className="flex items-center gap-2 mb-4">
                                                     <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                    <h3 className="font-semibold text-muted-foreground">Completed Today</h3>
                                                </div>
                                                <div className="space-y-4">
                                                    {completedTasks.map(task => <TaskItem key={task.id} task={task} />)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            ) : (
                 <div className="text-center py-12 text-muted-foreground">
                    <p>No tasks are active or were completed today. Enjoy the calm!</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
