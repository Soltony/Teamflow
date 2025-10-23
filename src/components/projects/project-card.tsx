
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Calendar, Users, PlusCircle, Pencil, Trash2, ShieldAlert, ChevronDown, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import type { Task, User, Milestone, Project } from '@/lib/types';
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

type ProjectListItemProps = {
  project: any;
  users: User[];
  onAddTask: (project: Project & { milestones: Milestone[] }) => void;
  onEditTask: (task: any, project: any) => void;
  onDeleteTask: (task: any) => void;
  taskToDelete: any;
  setTaskToDelete: (task: any) => void;
  handleDeleteTask: () => void;
};

export function ProjectListItem({ project, users, onAddTask, onEditTask, onDeleteTask, taskToDelete, setTaskToDelete, handleDeleteTask }: ProjectListItemProps) {
  const { hasPermission } = useAuth();
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | 'all'>('all');

  const canManageTasks = hasPermission('projects:update');
  
  const userCreatedMilestones = (project.milestones || []).filter((m: any) => m.title !== 'General Tasks');
  const allTasks = (project.milestones || []).flatMap((m: any) => m.tasks || []);

  const filteredTasks = selectedMilestoneId === 'all' 
    ? allTasks 
    : project.milestones.find((m: any) => m.id === selectedMilestoneId)?.tasks || [];
  
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

  const progress = calculateProjectProgress(project);
  const projectManager = users.find(u => u.id === project.projectManagerId);
    
  return (
    <>
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <Link href={`/projects/${project.id}`}>
            <CardTitle className="text-xl font-bold hover:underline">{project.name}</CardTitle>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/projects/${project.id}`} className="text-muted-foreground hover:text-primary">
              <Eye className="w-5 h-5" />
            </Link>
            <Badge variant="secondary" className="text-base whitespace-nowrap relative overflow-hidden border-2 border-gray-300">
              <div 
                className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.round(progress)}%`,
                  background: progress < 25 ? '#ef4444' : progress < 50 ? '#f59e0b' : progress < 75 ? '#eab308' : '#22c55e'
                }}
              />
              <span className="relative z-10 font-semibold">{Math.round(progress)}% Done</span>
            </Badge>
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

      <CardContent className="flex-grow flex flex-col justify-end">
        <div 
            className="flex justify-between items-center cursor-pointer p-2 -m-2" 
            onClick={(e) => {
                e.stopPropagation();
                setTasksExpanded(!tasksExpanded);
            }}
        >
            <h4 className="font-semibold">Tasks ({allTasks.length})</h4>
            <div className="flex items-center gap-2">
                {canManageTasks && (
                    <Button variant="secondary" size="sm" onClick={handleAddTaskClick}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Task
                    </Button>
                )}
                <div className="cursor-pointer p-1">
                    <ChevronDown className={cn("h-5 w-5 transition-transform", tasksExpanded && "rotate-180")} />
                </div>
            </div>
        </div>
        
        {tasksExpanded && (
          <div className="mt-2 space-y-3">
            {allTasks.length > 0 && userCreatedMilestones.length > 0 && (
                <Select value={selectedMilestoneId} onValueChange={setSelectedMilestoneId}>
                    <SelectTrigger className="w-full sm:w-[240px] h-9">
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
            {filteredTasks.length > 0 ? (
              <>
                {filteredTasks.map((task: any) => (
                  <div key={task.id} className="space-y-1 group">
                      <div className="flex justify-between items-center">
                          <span className="text-sm font-medium truncate flex-1 pr-2">{task.title}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs text-muted-foreground">W: {task.weight}%</span>
                              <span className="text-xs font-semibold text-muted-foreground">{task.progress || 0}%</span>
                              {canManageTasks && (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditTask(task, project)}>
                                        <Eye className="h-3 w-3" />
                                      </Button>
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
                      <Progress value={task.progress || 0} className="h-1.5" />
                  </div>
                ))}
              </>
            ) : (
                 <div className="text-center text-sm text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                    No tasks yet for this selection.
                </div>
            )}
        </div>
        )}
      </CardContent>

      {project.timelineChangeRequests?.length > 0 && (
          <div className="p-6 pt-0">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                           <Link href={`/projects/${project.id}?tab=timeline`}>
                            <Badge variant="outline" className="gap-1.5 items-center bg-amber-100 border-amber-300 text-amber-900 cursor-pointer">
                                <ShieldAlert className="w-3.5 h-3.5"/>
                                Pending Timeline Approval
                            </Badge>
                           </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>A deadline change for this project is awaiting approval.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
          </div>
      )}
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
    </>
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

    const cardContent = (
      <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
          <CardHeader>
              <CardTitle className="truncate">{project.name}</CardTitle>
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
          <div className="p-6 pt-0 flex justify-between text-xs text-muted-foreground">
              <span>{project.status.name}</span>
              <span>Due: {format(parseISO(project.endDate), 'MMM dd, yyyy')}</span>
          </div>
      </Card>
    );

    return (
      <Link href={href || `/projects/${project.id}`} className="h-full">
        {cardContent}
      </Link>
    )
}
