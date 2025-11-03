

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { getWeeklyTasks } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Task, User } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { isWithinInterval, parseISO, format, startOfWeek, endOfWeek, addDays, subDays, isSameDay } from 'date-fns';
import { Clock, Edit3, CheckCircle, Crown, Search, ChevronDown, ListTodo, CalendarDays, ChevronLeft, ChevronRight, CalendarIcon, Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type TaskWithAssigneesAndUpdates = Task & { 
    assignees: User[],
    updates: {createdAt: string, progressPercentage: number | null}[],
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
  tasks: TaskWithAssigneesAndUpdates[];
  milestones: any[];
};

function LoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

const TaskItem = ({ task, weekInterval }: { task: TaskWithAssigneesAndUpdates, weekInterval: {start: Date, end: Date} }) => {
    const isDueThisWeek = isWithinInterval(parseISO(task.endDate as unknown as string), weekInterval);
    const wasCompletedThisWeek = task.completedAt && isWithinInterval(parseISO(task.completedAt as unknown as string), weekInterval);
    
    const weeklyUpdates = useMemo(() => 
        (task.updates || [])
            .map(u => ({...u, createdAt: parseISO(u.createdAt)}))
            .filter(update => isWithinInterval(update.createdAt, weekInterval))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    , [task.updates, weekInterval]);

    const wasUpdatedThisWeek = !wasCompletedThisWeek && weeklyUpdates.length > 0;
    
    const progressText = useMemo(() => {
        if (wasCompletedThisWeek) {
            return `100%`;
        }
        
        if (wasUpdatedThisWeek) {
            const allUpdatesSorted = (task.updates || [])
                .map(u => ({ ...u, createdAt: parseISO(u.createdAt) }))
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
            const mostRecentUpdateThisWeek = allUpdatesSorted.find(u => isWithinInterval(u.createdAt, weekInterval));
            
            if (mostRecentUpdateThisWeek?.progressPercentage !== null) {
                const updateBeforeThat = allUpdatesSorted.find(u => u.createdAt.getTime() < mostRecentUpdateThisWeek.createdAt.getTime() && u.progressPercentage !== null);
                const previousProgress = updateBeforeThat?.progressPercentage ?? 0;
                const currentProgress = mostRecentUpdateThisWeek.progressPercentage;

                if (currentProgress !== previousProgress) {
                    return `${previousProgress}% → ${currentProgress || 0}%`;
                }
            }
        }
        
        return `${task.progress || 0}%`;
    }, [task, wasCompletedThisWeek, wasUpdatedThisWeek, weekInterval]);

    const shortTitle = task.title.length > 25
        ? `${task.title.substring(0, 25)}...`
        : task.title;

    return (
        <TooltipProvider>
            <div className="p-3 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                <Link href={`/tasks/${task.id}`} className="hover:underline">
                    <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    
                                        <h4 className="font-semibold text-sm truncate">{shortTitle}</h4>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{task.title}</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex -space-x-2 flex-shrink-0">
                            {task.assignees.slice(0, 3).map(assignee => (
                                <Tooltip key={assignee.id}>
                                    <TooltipTrigger>
                                        <Avatar className="h-5 w-5 border-2 border-background">
                                            <AvatarImage src={assignee.avatar || undefined} />
                                            <AvatarFallback className="text-xs">{assignee.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{assignee.name}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                            {task.assignees.length > 3 && (
                                <div className="h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                    <span className="text-[10px] font-semibold">+{task.assignees.length - 3}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </Link>
                
                {!wasCompletedThisWeek && (
                    <div className="flex items-center gap-2 mb-2">
                        <Progress value={task.progress || 0} className="flex-1 h-1.5" />
                        <span className="text-[10px] font-semibold">{progressText}</span>
                    </div>
                )}
                
                <div className="flex flex-wrap gap-1">
                    {isDueThisWeek && !wasCompletedThisWeek && (
                        <Badge className="flex items-center gap-1 text-xs bg-red-100 text-red-800 border-red-200 hover:bg-red-200">
                            <Clock className="w-3 h-3" /> Due This Week
                        </Badge>
                    )}
                    {wasUpdatedThisWeek && (
                        <Badge className="flex items-center gap-1 text-xs bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200">
                            <Edit3 className="w-3 h-3" /> Updated
                        </Badge>
                    )}
                    {wasCompletedThisWeek && (
                        <Badge className="flex items-center gap-1 text-xs bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
                            <CheckCircle className="w-3 h-3" /> Completed
                        </Badge>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
};

const calculateMilestoneProgress = (milestone: any) => {
    if (!milestone.tasks || milestone.tasks.length === 0) return 0;
    const totalProgress = milestone.tasks.reduce((acc: number, task: any) => {
        const taskProgress = task.progress || 0;
        return acc + (taskProgress * (task.weight / 100));
    }, 0);
    return totalProgress;
};

const calculateProjectProgress = (project: ProjectWithTasks) => {
    if (!project.milestones || project.milestones.length === 0) {
        return 0;
    }
    const weightedMilestones = project.milestones.filter((m: any) => m.weight > 0);
    if (weightedMilestones.length > 0) {
        return weightedMilestones.reduce((acc: number, milestone: any) => {
            const milestoneProgress = calculateMilestoneProgress(milestone);
            return acc + (milestoneProgress * (milestone.weight / 100));
        }, 0);
    } else {
        const allTasks = project.milestones.flatMap((m: any) => m.tasks);
        if (allTasks.length === 0) return 0;
        const totalTaskWeight = allTasks.reduce((sum: number, task: any) => sum + task.weight, 0);
        if (totalTaskWeight === 0) {
            const totalProgress = allTasks.reduce((sum: number, task: any) => sum + (task.progress || 0), 0);
            return allTasks.length > 0 ? totalProgress / allTasks.length : 0;
        }
        const totalWeightedTaskProgress = allTasks.reduce((acc: number, task: any) => {
            return acc + ((task.progress || 0) * task.weight);
        }, 0);
        return totalWeightedTaskProgress / totalTaskWeight;
    }
};

const ProjectCard = ({ project, isExpanded, onToggleExpand, weekInterval }: { project: ProjectWithTasks, isExpanded: boolean, onToggleExpand: () => void, weekInterval: {start: Date, end: Date} }) => {
    const totalTasks = project.tasks.length;
    const projectProgress = calculateProjectProgress(project);
    
    return (
        <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
            <CardHeader className="cursor-pointer" onClick={onToggleExpand}>
                <div className="flex justify-between items-start gap-4">
                    <Link href={`/projects/${project.id}`} className="flex-1 truncate" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <CardTitle className="text-lg font-bold hover:underline truncate">{project.name}</CardTitle>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{project.name}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </Link>
                    <ChevronDown className={cn("h-5 w-5 transition-transform text-muted-foreground", isExpanded && "rotate-180")} />
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <Progress value={projectProgress} className="h-2 flex-1" />
                    <span className="text-sm font-semibold w-12 text-right">{Math.round(projectProgress)}%</span>
                    <Badge variant="outline">Tasks: {totalTasks}</Badge>
                </div>
            </CardHeader>

            {isExpanded && (
                 <CardContent className="flex-grow flex flex-col justify-end pt-0">
                    <div className="space-y-3">
                        {project.tasks.length > 0 ? (
                            project.tasks.map(task => (
                                <TaskItem key={task.id} task={task} weekInterval={weekInterval} />
                            ))
                        ) : (
                            <div className="text-center text-sm text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                                No activity recorded for this project this week.
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

export default function WeeklyActivitiesPage() {
    const { localUser, hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
    const [stats, setStats] = useState({ projectsActive: 0, tasksUpdated: 0, tasksCompleted: 0, tasksDueNextWeek: 0 });
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
                const data = await getWeeklyTasks(localUser.id, targetDate);
                setProjects(data.projects);
                setStats(data.stats);
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
        if (!searchQuery) return projects;
        
        return projects.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.tasks.some(task => 
                task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
            )
        );
    }, [projects, searchQuery]);

    const handleToggleExpand = (projectId: string) => {
        setExpandedProjectId(prevId => (prevId === projectId ? null : projectId));
    };

    if (isLoading || authLoading) {
        return <LoadingSkeleton />;
    }
  
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="space-y-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="w-6 h-6"/> Weekly Activities</h1>
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
                        <Button variant="ghost" size="sm" onClick={() => handleDateChange(addDays(new Date(), 7))}>Next Week</Button>
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
                            <div className="text-2xl font-bold">{stats.projectsActive}</div>
                            <p className="text-xs text-muted-foreground">Projects with activity this week</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasks Updated</CardTitle>
                            <Edit3 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.tasksUpdated}</div>
                            <p className="text-xs text-muted-foreground">Tasks with new progress updates</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.tasksCompleted}</div>
                            <p className="text-xs text-muted-foreground">Tasks marked as 'Done' this week</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Due Next Week</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.tasksDueNextWeek}</div>
                            <p className="text-xs text-muted-foreground">Upcoming task deadlines</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
      
            {filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    {filteredProjects.map((project: ProjectWithTasks) => (
                    <ProjectCard 
                        key={project.id} 
                        project={project}
                        isExpanded={expandedProjectId === project.id}
                        onToggleExpand={() => handleToggleExpand(project.id)}
                        weekInterval={weekInterval}
                    />
                    ))}
                </div>
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
