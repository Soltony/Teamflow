

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { getWeeklyTasks } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Task, User, TaskUpdate } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { isWithinInterval, parseISO, format, startOfWeek, endOfWeek, addDays, subDays, isSameDay, formatDistanceToNow } from 'date-fns';
import { Clock, Edit3, CheckCircle, Search, CalendarClock, ChevronLeft, ChevronRight, CalendarIcon, Briefcase, XCircle, Activity, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

type TaskWithRelations = Task & { 
    assignees: User[],
    updates: (TaskUpdate & {author: User})[],
    milestone: {
        title: string;
        project: {
            id: string;
            name: string;
            description: string;
            status: { name: string };
            projectManager: { name: string };
            pmoDivision: { name: string };
            startDate: string;
            endDate: string;
            milestones: any[];
        };
    };
};

type ProjectWithTasks = {
  id: string;
  name: string;
  description: string;
  status: { name: string };
  projectManager: { name: string };
  pmoDivision: { name: string };
  startDate: string;
  endDate: string;
  milestones: any[];
  tasks: TaskWithRelations[];
};

function LoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  );
}

const TaskItem = ({ task, weekInterval, userMap }: { task: TaskWithRelations, weekInterval: {start: Date, end: Date}, userMap: Map<string, User>}) => {
    return (
        <AccordionItem value={task.id} className="border-b-0">
            <Card>
                <AccordionTrigger className="p-3 hover:no-underline text-left">
                     <div className="flex justify-between items-center gap-2 w-full">
                        <div className="flex items-center gap-3">
                            <Link href={`/tasks/${task.id}`} className="font-semibold text-sm hover:underline" onClick={(e) => e.stopPropagation()}>
                                {task.title}
                            </Link>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {isWithinInterval(parseISO(task.endDate as unknown as string), weekInterval) && task.status !== 'DONE' && (
                                <Badge className="flex items-center gap-1 text-xs bg-red-100 text-red-800 border-red-200 hover:bg-red-200">
                                    <Clock className="w-3 h-3" /> Due This Week
                                </Badge>
                            )}
                            {task.updates?.some(update => isWithinInterval(parseISO(update.createdAt as unknown as string), weekInterval)) && !(task.completedAt && isWithinInterval(parseISO(task.completedAt as unknown as string), weekInterval)) && (
                                <Badge className="flex items-center gap-1 text-xs bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200">
                                    <Edit3 className="w-3 h-3" /> Updated
                                </Badge>
                            )}
                            {task.completedAt && isWithinInterval(parseISO(task.completedAt as unknown as string), weekInterval) && (
                                <Badge className="flex items-center gap-1 text-xs bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
                                    <CheckCircle className="w-3 h-3" /> Completed
                                </Badge>
                            )}
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-3 pt-0">
                    <Separator className="mb-3"/>
                    <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge variant="outline">Milestone: {task.milestone.title}</Badge>
                        <Badge variant="outline">Assignees: {task.assignees.map(a => userMap.get(a.id)?.name).filter(Boolean).join(', ')}</Badge>
                        <Badge variant="secondary">Due: {format(parseISO(task.endDate as unknown as string), 'MMM dd, yyyy')}</Badge>
                        <Badge variant="secondary">Progress: {task.progress || 0}%</Badge>
                    </div>
                    {task.updates && task.updates.length > 0 && (
                        <>
                            <Separator className="my-3"/>
                            <h4 className="font-semibold text-xs mb-2">Update History</h4>
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                {task.updates.map(update => {
                                    const author = userMap.get(update.authorId);
                                    if (update.type === 'STATUS_CHANGE') {
                                        const isApproval = update.text.includes('approved');
                                        return (
                                            <div key={update.id} className="flex items-start gap-3">
                                                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                                                    {isApproval ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-destructive" />}
                                                </div>
                                                <div className="flex-1 text-xs bg-muted/50 p-2 rounded-md">
                                                    <p className="text-muted-foreground italic">{update.text} by <span className="font-semibold">{author?.name}</span></p>
                                                    <p className="text-right text-muted-foreground/80">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={update.id} className="flex items-start gap-3">
                                            <Avatar className="w-6 h-6 border">
                                                <AvatarImage src={author?.avatar} alt={author?.name} />
                                                <AvatarFallback>{author?.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 text-xs bg-muted/50 p-2 rounded-md">
                                                <p>{update.text}</p>
                                                {update.progressPercentage !== null && (
                                                <div className="mt-1 text-muted-foreground">Progress reported: <span className="font-bold">{update.progressPercentage}%</span></div>
                                                )}
                                                <p className="text-right text-muted-foreground/80">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
};

const ProjectAccordion = ({ project, weekInterval, userMap }: { 
    project: ProjectWithTasks, 
    weekInterval: {start: Date, end: Date},
    userMap: Map<string, User>,
}) => {
    const totalTasks = project.tasks.length;
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    const calculateMilestoneProgress = (milestone: any) => {
        if (!milestone.tasks || milestone.tasks.length === 0) return 0;
        const totalProgress = milestone.tasks.reduce((acc: number, task: any) => {
            const taskProgress = task.progress || 0;
            return acc + (taskProgress * (task.weight / 100));
        }, 0);
        return totalProgress;
    };

    const calculateProjectProgress = (proj: any) => {
        if (!proj.milestones || proj.milestones.length === 0) return 0;
        const weightedMilestones = proj.milestones.filter((m: any) => m.weight > 0);
        if (weightedMilestones.length > 0) {
            return weightedMilestones.reduce((acc: number, milestone: any) => acc + (calculateMilestoneProgress(milestone) * (milestone.weight / 100)), 0);
        } else {
            const allTasks = proj.milestones.flatMap((m: any) => m.tasks);
            if (allTasks.length === 0) return 0;
            const totalTaskWeight = allTasks.reduce((sum: number, task: any) => sum + task.weight, 0);
            if (totalTaskWeight === 0) {
                const totalProgress = allTasks.reduce((sum: number, task: any) => sum + (task.progress || 0), 0);
                return totalProgress / allTasks.length;
            }
            const totalWeightedTaskProgress = allTasks.reduce((acc: number, task: any) => acc + ((task.progress || 0) * task.weight), 0);
            return totalWeightedTaskProgress / totalTaskWeight;
        }
    };
    
    const projectProgress = calculateProjectProgress(project);

    return (
        <Card>
            <AccordionTrigger className="p-4 hover:no-underline">
                 <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
                    <div className="flex-1 text-left space-y-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <h3 className="text-lg font-bold hover:underline truncate">{project.name}</h3>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{project.name}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <CalendarClock className="h-4 w-4" />
                                <span>Closing Date: {format(parseISO(project.endDate), 'MMM dd, yyyy')}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Progress value={projectProgress} className="h-2 flex-1" />
                        <span className="text-sm font-semibold w-12 text-right">{Math.round(projectProgress)}%</span>
                        <Badge variant="outline">Tasks: {totalTasks}</Badge>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
                <Accordion type="single" collapsible className="w-full space-y-2" value={expandedTaskId || ""} onValueChange={setExpandedTaskId}>
                    {project.tasks.length > 0 ? (
                        project.tasks.map(task => (
                            <TaskItem key={task.id} task={task} weekInterval={weekInterval} userMap={userMap}/>
                        ))
                    ) : (
                        <div className="text-center text-sm text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                            No activity recorded for this project this week.
                        </div>
                    )}
                </Accordion>
            </AccordionContent>
        </Card>
    );
};

export default function WeeklyActivitiesPage() {
  const { localUser, hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<{projects: ProjectWithTasks[], users: User[], stats: any}>({projects: [], users: [], stats: { projectsActive: 0, tasksWithActivity: 0, tasksRemaining: 0, tasksCompleted: 0 }});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(() => {
      const dateParam = searchParams.get('date');
      return dateParam ? parseISO(dateParam) : new Date();
  });

  const weekInterval = useMemo(() => ({
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
  }), [date]);
  
  const handleDateChange = (newDate: Date) => {
      const newDateString = format(newDate, 'yyyy-MM-dd');
      setDate(newDate);
      router.push(`/weekly-activities?date=${newDateString}`);
  };

  const fetchData = useCallback(async (targetDate: Date) => {
      if (localUser?.id) {
          setIsLoading(true);
          try {
              const fetchedData = await getWeeklyTasks(localUser.id, targetDate);
              setData(fetchedData as any);
          } catch (error) {
              console.error("Failed to fetch weekly tasks", error);
          } finally {
              setIsLoading(false);
          }
      }
  }, [localUser?.id]);

  useEffect(() => {
      if (!authLoading) {
          if (!hasPermission('dashboard:view')) {
              router.replace('/dashboard');
          } else {
              fetchData(date);
          }
      }
  }, [authLoading, hasPermission, router, fetchData, date]);

  const filteredProjects = useMemo(() => {
      if (!searchQuery) return data.projects;
      
      return data.projects.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.tasks.some(task => 
              task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
          )
      );
  }, [data.projects, searchQuery]);
  
  useEffect(() => {
      setExpandedProjectId(null);
  }, [searchQuery, date]);

  const userMap = useMemo(() => new Map(data.users.map(u => [u.id, u])), [data.users]);
  
  if (isLoading || authLoading) {
      return <LoadingSkeleton />;
  }
  
  return (
      <div className="p-4 sm:p-6 space-y-6">
          <div className="space-y-4">
              <div className="space-y-1">
                  <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarIcon className="w-6 h-6"/> Weekly Activities</h1>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                      A weekly overview of your team's progress, completions, and upcoming deadlines.
                  </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 border rounded-lg bg-card">
                  <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleDateChange(subDays(date, 7))}><ChevronLeft className="h-4 w-4" /></Button>
                      <Popover>
                          <PopoverTrigger asChild>
                              <Button variant={"outline"} className="w-[280px] justify-start text-left font-normal">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  Week of {format(weekInterval.start, 'MMM d')} – {format(weekInterval.end, 'MMM d, yyyy')}
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={date} onSelect={(d) => d && handleDateChange(d)} initialFocus />
                          </PopoverContent>
                      </Popover>
                      <Button variant="outline" size="icon" onClick={() => handleDateChange(addDays(date, 7))}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                   <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleDateChange(subDays(new Date(), 7))}>Last Week</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDateChange(new Date())} disabled={isSameDay(date, new Date())}>This Week</Button>
                  </div>
                   <div className="relative flex-1 sm:max-w-xs w-full">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                          type="search"
                          placeholder="Search projects and tasks..."
                          className="w-full rounded-lg bg-background pl-8"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                      />
                  </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{data.stats.projectsActive}</div>
                          <p className="text-xs text-muted-foreground">Projects with activity this week</p>
                      </CardContent>
                  </Card>
                   <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Tasks with Activity</CardTitle>
                          <Activity className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{data.stats.tasksWithActivity}</div>
                          <p className="text-xs text-muted-foreground">Due, updated, or completed</p>
                      </CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Remaining to Complete</CardTitle>
                          <Target className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{data.stats.tasksRemaining}</div>
                          <p className="text-xs text-muted-foreground">Tasks not yet marked 'Done'</p>
                      </CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{data.stats.tasksCompleted}</div>
                          <p className="text-xs text-muted-foreground">Tasks marked as 'Done' this week</p>
                      </CardContent>
                  </Card>
              </div>
          </div>
    
          {filteredProjects.length > 0 ? (
               <Accordion 
                  type="single" 
                  collapsible 
                  className="w-full space-y-4"
                  value={expandedProjectId || ""} 
                  onValueChange={setExpandedProjectId}
              >
                  {filteredProjects.map((project: ProjectWithTasks) => (
                    <AccordionItem value={project.id} key={project.id} className="border-none">
                      <ProjectAccordion 
                          project={project}
                          weekInterval={weekInterval}
                          userMap={userMap}
                      />
                    </AccordionItem>
                  ))}
              </Accordion>
          ) : (
              <div className="text-center py-24 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground font-semibold">No activity found for this week.</p>
              <p className="text-muted-foreground text-sm">
                  {searchQuery ? "Try adjusting your search query." : "Try selecting a different week."}
              </p>
              </div>
          )}
      </div>
  );
}
