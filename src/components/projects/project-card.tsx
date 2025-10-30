

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Crown, Calendar, Users, PlusCircle, Pencil, Trash2, ChevronDown, Eye, ShieldAlert, Edit, CheckSquare } from 'lucide-react';
import { format, parseISO, isAfter, endOfDay, isToday } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import type { Task, User, Milestone, Project, Team } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';


type ProjectListItemProps = {
  project: any;
  users: User[];
  onAddTask: (project: Project & { milestones: Milestone[] }) => void;
  onEditTask: (task: any, project: any) => void;
  onDeleteTask: (task: any) => void;
  taskToDelete: any;
  setTaskToDelete: (task: any) => void;
  handleDeleteTask: () => void;
  onAddTeam: (project: Project) => void;
  onEditTeam: (team: Team, project: Project) => void;
  onDeleteTeam: (team: Team) => void;
  canManageTeams: { create: boolean; update: boolean; delete: boolean };
  teamToDelete: Team | null;
  setTeamToDelete: (team: Team | null) => void;
  handleDeleteTeam: () => void;
};


const ProgressBadge = ({ progress, isOverdue }: { progress: number, isOverdue: boolean }) => {
    const isComplete = progress >= 100;
    const badgeColor = isComplete ? 'bg-green-600' : isOverdue ? 'bg-red-600' : 'bg-primary';
    const textColor = 'text-primary-foreground';
  
    return (
      <div className={cn(
        "relative inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-6",
        badgeColor,
        textColor
      )}>
        <div className="absolute left-0 top-0 h-full rounded-full bg-white/20" style={{ width: `${progress}%` }}/>
        <span className="relative">{Math.round(progress)}% Done</span>
      </div>
    );
};


export function ProjectListItem({ 
    project, 
    users, 
    onAddTask, 
    onEditTask, 
    onDeleteTask, 
    taskToDelete, 
    setTaskToDelete, 
    handleDeleteTask,
    onAddTeam,
    onEditTeam,
    onDeleteTeam,
    canManageTeams,
    teamToDelete,
    setTeamToDelete,
    handleDeleteTeam
}: ProjectListItemProps) {
  const { hasPermission } = useAuth();
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [teamsExpanded, setTeamsExpanded] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | 'all'>('all');

  const canManageTasks = hasPermission('projects:update');
  
  const userCreatedMilestones = (project.milestones || []).filter((m: any) => m.title !== 'General Tasks');
  
  const allTasks = useMemo(() => 
    (project.milestones || []).flatMap((m: any) => m.tasks || [])
  , [project.milestones]);


  const { todaysTasks, otherTasks } = useMemo(() => {
    const todays: any[] = [];
    const others: any[] = [];

    allTasks.forEach((task: any) => {
      if (task.createdAt && isToday(parseISO(task.createdAt))) {
        todays.push(task);
      } else {
        others.push(task);
      }
    });
    return { todaysTasks: todays, otherTasks: others };
  }, [allTasks]);


  const filteredTasks = selectedMilestoneId === 'all' 
    ? otherTasks 
    : project.milestones.find((m: any) => m.id === selectedMilestoneId)?.tasks.filter((t: any) => !todaysTasks.some(tt => tt.id === t.id)) || [];
  
  const calculateMilestoneProgress = (milestone: any) => {
    if (!milestone.tasks || milestone.tasks.length === 0) return 0;
    const totalProgress = milestone.tasks.reduce((acc: number, task: any) => {
        const taskProgress = task.progress || 0;
        return acc + (taskProgress * (task.weight / 100));
    }, 0);
    return totalProgress;
  };

  const calculateProjectProgress = (project: any) => {
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
          if (allTasks.length === 0) return 0;
          const totalProgress = allTasks.reduce((sum: number, task: any) => sum + (task.progress || 0), 0);
          return totalProgress / allTasks.length;
      }
      
      const totalWeightedTaskProgress = allTasks.reduce((acc: number, task: any) => {
        return acc + ((task.progress || 0) * task.weight);
      }, 0);

      return totalWeightedTaskProgress / totalTaskWeight;
    }
  };

  const handleAddTaskClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddTask(project);
  };
  
  const handleAddTeamClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddTeam(project);
  };
  
  const handleEditTeamClick = (e: React.MouseEvent, team: Team) => {
    e.stopPropagation();
    onEditTeam(team, project);
  };
  
  const handleDeleteTeamClick = (e: React.MouseEvent, team: Team) => {
    e.stopPropagation();
    onDeleteTeam(team);
  };

  const progress = calculateProjectProgress(project);
  const projectManager = users.find(u => u.id === project.projectManagerId);
  
  const nonArchivedStatusNames = ['Active', 'Pending', 'Parked'];
  const isProjectOverdue = nonArchivedStatusNames.includes(project.status.name) && isAfter(new Date(), endOfDay(parseISO(project.endDate)));
  const openBlockersCount = project.blockers?.length || 0;
  
  const TaskRow = ({task}: {task: any}) => {
    const isTaskDone = task.status === 'DONE';
    const isTaskOverdue = isAfter(new Date(), endOfDay(parseISO(task.endDate))) && !isTaskDone;
    const indicatorClassName = isTaskDone ? 'bg-green-600' : isTaskOverdue ? 'bg-destructive' : 'bg-primary';

    return (
        <div key={task.id} className="space-y-1.5 group">
            <div className="flex justify-between items-center gap-2">
              <div className="flex-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm font-medium pr-2 block truncate max-w-14">
                        {task.title}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{task.title}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">W: {task.weight}%</span>
                    <span className="text-xs font-semibold text-muted-foreground">{task.progress || 0}%</span>
                    {canManageTasks && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                            <Link href={`/tasks/${task.id}`}>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <Eye className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditTask(task, project)}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDeleteTask(task)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <Progress value={task.progress || 0} className="h-1.5" indicatorClassName={indicatorClassName} />
        </div>
      )
  }
    
  return (
    <TooltipProvider>
      <Card className="flex flex-col h-full">
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <Link href={`/projects/${project.id}`} className="truncate">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-xl font-bold hover:underline truncate">{project.name}</CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{project.name}</p>
                  </TooltipContent>
                </Tooltip>
              </Link>
            </div>
            <div className='flex items-center gap-2 flex-shrink-0'>
                {openBlockersCount > 0 && (
                  <Link href={`/projects/${project.id}?tab=blockers`}>
                      <Badge variant="destructive" className="flex items-center gap-1 cursor-pointer">
                          <ShieldAlert className="w-3 h-3"/> {openBlockersCount} Blocker{openBlockersCount > 1 ? 's' : ''}
                      </Badge>
                  </Link>
                )}
                <ProgressBadge progress={progress} isOverdue={isProjectOverdue} />
              </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground pt-2">
              <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  <span>Lead: {projectManager?.name ?? 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{format(parseISO(project.startDate), "MMM d")} - {format(parseISO(project.endDate), "MMM d, yyyy")}</span>
              </div>
          </div>
        </CardHeader>

        <CardContent className="flex-grow flex flex-col justify-end pt-0">
          <Separator className="mb-4" />
          
          {/* Teams Section */}
          <div className="space-y-3">
            <div 
                className="flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                    e.stopPropagation();
                    setTeamsExpanded(!teamsExpanded);
                }}
            >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <h4 className="font-semibold text-blue-700">Teams ({project.teams?.length || 0})</h4>
                </div>
                <div className="flex items-center gap-2">
                    {canManageTeams.create && (
                        <Button variant="secondary" size="sm" onClick={handleAddTeamClick}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Team
                        </Button>
                    )}
                    <div className="cursor-pointer p-1">
                        <ChevronDown className={cn("h-5 w-5 transition-transform text-blue-600", teamsExpanded && "rotate-180")} />
                    </div>
                </div>
            </div>

            {teamsExpanded && (
              <div className="ml-6 space-y-3 border-l-2 border-blue-200 pl-4">
                {(project.teams && project.teams.length > 0) ? (
                    <div className="space-y-3">
                        {project.teams.map((team: any) => {
                            const teamLead = team.teamLead;
                            const teamMembers = team.members.filter((m: any) => m.id !== team.teamLeadId);

                            return (
                                <div key={team.id} className="text-sm p-3 rounded-md bg-blue-50 border border-blue-200 group">
                                    <div className="flex justify-between items-start">
                                        <h5 className="font-semibold text-blue-800">{team.name}</h5>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canManageTeams.update && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleEditTeamClick(e, team)}>
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                            )}
                                            {canManageTeams.delete && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => handleDeleteTeamClick(e, team)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-blue-600 mt-1 space-y-1">
                                        {teamLead && <p><span className="font-semibold">Lead:</span> {teamLead.name}</p>}
                                        {teamMembers.length > 0 && <p><span className="font-semibold">Members:</span> {teamMembers.map((m: any) => m.name).join(', ')}</p>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-blue-600 mt-2">No teams assigned.</p>
                )}
              </div>
            )}
          </div>

          {/* Visual Separator */}
          <Separator className="my-4" />

          {/* Tasks Section */}
          <div className="space-y-3">
            <div 
                className="flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors" 
                onClick={(e) => {
                    e.stopPropagation();
                    setTasksExpanded(!tasksExpanded);
                }}
            >
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-green-600" />
                  <h4 className="font-semibold text-green-700">Tasks ({allTasks.length})</h4>
                </div>
                <div className="flex items-center gap-2">
                    {canManageTasks && (
                        <Button variant="secondary" size="sm" onClick={handleAddTaskClick}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Task
                        </Button>
                    )}
                    <div className="cursor-pointer p-1">
                        <ChevronDown className={cn("h-5 w-5 transition-transform text-green-600", tasksExpanded && "rotate-180")} />
                    </div>
                </div>
            </div>
          
          {tasksExpanded && (
            <div className="ml-6 space-y-3 border-l-2 border-green-200 pl-4">
              {allTasks.length > 0 ? (
                <Tabs defaultValue="today" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="today">Today's Tasks ({todaysTasks.length})</TabsTrigger>
                        <TabsTrigger value="other">Other Tasks ({otherTasks.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="today">
                      {todaysTasks.length > 0 ? (
                        <ScrollArea className="h-48 pr-3">
                          <div className="space-y-1.5">
                            {todaysTasks.map((task: any) => <TaskRow key={task.id} task={task} />)}
                          </div>
                        </ScrollArea>
                      ) : (
                         <div className="text-center text-sm text-green-600 py-4 border-2 border-dashed border-green-200 rounded-lg bg-green-50">
                            No tasks were created today.
                         </div>
                      )}
                    </TabsContent>
                    <TabsContent value="other">
                        {userCreatedMilestones.length > 0 && (
                            <Select value={selectedMilestoneId} onValueChange={setSelectedMilestoneId}>
                                <SelectTrigger className="w-full sm:w-[240px] h-9 mb-4">
                                    <SelectValue placeholder="Filter by milestone..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Milestones</SelectItem>
                                    {userCreatedMilestones.map((m: any) => (
                                        <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <ScrollArea className="h-48 pr-3">
                          <div className="space-y-1.5">
                            {filteredTasks.map((task: any) => <TaskRow key={task.id} task={task} />)}
                          </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
              ) : (
                   <div className="text-center text-sm text-green-600 py-4 border-2 border-dashed border-green-200 rounded-lg bg-green-50">
                      No tasks yet for this project.
                  </div>
              )}
            </div>
          )}
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the task: <span className="font-semibold">{taskToDelete?.title}</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Task
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!teamToDelete} onOpenChange={() => setTeamToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the team: <span className="font-semibold">{teamToDelete?.name}</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Team
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </TooltipProvider>
  );
}

export function ProjectCard({ project, href }: { project: any, href?: string }) {

    const calculateMilestoneProgress = (milestone: any) => {
        if (!milestone.tasks || milestone.tasks.length === 0) return 0;
        const totalProgress = milestone.tasks.reduce((acc: number, task: any) => {
            const taskProgress = task.progress || 0;
            return acc + (taskProgress * (task.weight / 100));
        }, 0);
        return totalProgress;
    };

    const calculateProjectProgress = (project: any) => {
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
            if (allTasks.length === 0) return 0;
            const totalProgress = allTasks.reduce((sum: number, task: any) => sum + (task.progress || 0), 0);
            return totalProgress / allTasks.length;
        }
        
        const totalWeightedTaskProgress = allTasks.reduce((acc: number, task: any) => {
            return acc + ((task.progress || 0) * task.weight);
        }, 0);

        return totalWeightedTaskProgress / totalTaskWeight;
        }
    };

    const progress = calculateProjectProgress(project);
    const hasOpenBlockers = project.blockers && project.blockers.some((b: any) => b.status === 'OPEN');

    const cardContent = (
      <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
          <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="truncate">{project.name}</CardTitle>
                {hasOpenBlockers && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3"/> Blocker
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2">{project.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
               <div className="space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
              </div>
          </CardContent>
          <CardFooter className="flex justify-between text-xs text-muted-foreground">
              <span>{project.status.name}</span>
              <span>Due: {format(parseISO(project.endDate), 'MMM dd, yyyy')}</span>
          </CardFooter>
      </Card>
    );

    return (
      <Link href={href || `/projects/${project.id}`} className="h-full">
        {cardContent}
      </Link>
    )
}
