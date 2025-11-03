

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { getTodaysTasks } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Task, User } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { isToday, parseISO, format } from 'date-fns';
import { Clock, Edit3, CheckCircle, Crown, Search, ChevronDown, ListTodo } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

const TaskItem = ({ task }: { task: TaskWithAssigneesAndUpdates }) => {
    const isDueToday = isToday(parseISO(task.endDate as unknown as string));
    const wasCompletedToday = task.completedAt && isToday(parseISO(task.completedAt as unknown as string));
    
    const todaysUpdates = useMemo(() => 
        (task.updates || [])
            .map(u => ({...u, createdAt: parseISO(u.createdAt)}))
            .filter(update => isToday(update.createdAt))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    , [task.updates]);

    const wasUpdatedToday = !wasCompletedToday && todaysUpdates.length > 0;

    const progressText = useMemo(() => {
        if (wasCompletedToday) {
            return `100%`;
        }
        
        if (wasUpdatedToday) {
            const allUpdatesSorted = (task.updates || [])
                .map(u => ({ ...u, createdAt: parseISO(u.createdAt) }))
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
            const mostRecentUpdateToday = allUpdatesSorted[0];
            
            if (mostRecentUpdateToday?.progressPercentage !== null) {
                const updateBeforeThat = allUpdatesSorted.find(u => u.createdAt.getTime() < mostRecentUpdateToday.createdAt.getTime() && u.progressPercentage !== null);

                const previousProgress = updateBeforeThat?.progressPercentage ?? 0;
                const currentProgress = mostRecentUpdateToday.progressPercentage;

                 if (currentProgress !== previousProgress) {
                    return `${previousProgress}% → ${currentProgress || 0}%`;
                }
            }
        }
        
        return `${task.progress || 0}%`;
    }, [task, wasCompletedToday, wasUpdatedToday]);

    const shortTitle = task.title.length > 15
        ? `${task.title.substring(0, 15)}...`
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
                
                 {!wasCompletedToday && (
                    <div className="flex items-center gap-2 mb-2">
                        <Progress value={task.progress || 0} className="flex-1 h-1.5" />
                        <span className="text-[10px] font-semibold">{progressText}</span>
                    </div>
                )}
                
                <div className="flex flex-wrap gap-1">
                    {isDueToday && !wasCompletedToday && (
                        <Badge className="flex items-center gap-1 text-xs bg-red-100 text-red-800 border-red-200 hover:bg-red-200">
                            <Clock className="w-3 h-3" /> Due Today
                        </Badge>
                    )}
                    {wasUpdatedToday && (
                        <Badge className="flex items-center gap-1 text-xs bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200">
                            <Edit3 className="w-3 h-3" /> Updated Today
                        </Badge>
                    )}
                    {wasCompletedToday && (
                        <Badge className="flex items-center gap-1 text-xs bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
                            <CheckCircle className="w-3 h-3" /> Completed Today
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

const ProjectCard = ({ project, isExpanded, onToggleExpand }: { project: ProjectWithTasks, isExpanded: boolean, onToggleExpand: () => void }) => {
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
                                <TaskItem key={task.id} task={task} />
                            ))
                        ) : (
                            <div className="text-center text-sm text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                                No activity recorded for this project today.
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

export default function TodayPage() {
  const { localUser, hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedPmoDivision, setSelectedPmoDivision] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const projectsPerPage = 9;

  const fetchData = useCallback(async () => {
    if (localUser?.id) {
      setIsLoading(true);
      try {
        const data = await getTodaysTasks(localUser.id);
        setProjects(data);
      } catch (error) {
        console.error("Failed to fetch today's tasks", error);
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
        fetchData();
      }
    }
  }, [authLoading, hasPermission, router, fetchData]);

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tasks.some(task => 
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      );
    }
    
    if (selectedStatus) {
      filtered = filtered.filter(p => p.status.name === selectedStatus);
    }
    
    if (selectedPmoDivision) {
      filtered = filtered.filter(p => p.pmoDivision.name === selectedPmoDivision);
    }
    
    return filtered;
  }, [projects, searchQuery, selectedStatus, selectedPmoDivision]);

  const handleToggleExpand = (projectId: string) => {
    setExpandedProjectId(prevId => (prevId === projectId ? null : projectId));
  };
  
  useEffect(() => {
    setCurrentPage(1);
    setExpandedProjectId(null);
  }, [searchQuery, selectedStatus, selectedPmoDivision]);

  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * projectsPerPage;
    const endIndex = startIndex + projectsPerPage;
    return filteredProjects.slice(startIndex, endIndex);
  }, [filteredProjects, currentPage, projectsPerPage]);

  const uniqueStatuses = useMemo(() => {
    const statuses = projects.map(p => p.status.name);
    return [...new Set(statuses)];
  }, [projects]);

  const uniquePmoDivisions = useMemo(() => {
    const divisions = projects.map(p => p.pmoDivision.name);
    return [...new Set(divisions)];
  }, [projects]);
  
  if (isLoading || authLoading) {
    return <LoadingSkeleton />;
  }
  
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2"><ListTodo className="w-6 h-6"/> Today's Activity</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              A real-time picture of your team’s daily progress — showing what’s due and what’s getting done.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects and tasks..."
              className="w-full rounded-lg bg-background pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select onValueChange={(value) => setSelectedStatus(value === 'all' ? null : value)} value={selectedStatus || 'all'}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => setSelectedPmoDivision(value === 'all' ? null : value)} value={selectedPmoDivision || 'all'}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All EPMO Divisions</SelectItem>
              {uniquePmoDivisions.map(division => (
                <SelectItem key={division} value={division}>
                  {division}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {paginatedProjects.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paginatedProjects.map((project: ProjectWithTasks) => (
              <ProjectCard 
                key={project.id} 
                project={project}
                isExpanded={expandedProjectId === project.id}
                onToggleExpand={() => handleToggleExpand(project.id)}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-24 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground font-semibold">No activity found for today.</p>
          <p className="text-muted-foreground text-sm">
            {searchQuery || selectedStatus || selectedPmoDivision 
              ? "Try adjusting your filters to see more results." 
              : "No tasks are due, have been completed, or updated today."}
          </p>
        </div>
      )}
    </div>
  );
}
