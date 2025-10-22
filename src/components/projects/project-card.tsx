

'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Calendar, Users, PlusCircle, Pencil, Trash2, ShieldAlert } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

type ProjectListItemProps = {
  project: any;
  users: User[];
  onAddTask: (project: Project) => void;
  onEditTask: (task: any, project: any) => void;
  onDeleteTask: (task: any) => void;
  taskToDelete: any;
  setTaskToDelete: (task: any) => void;
  handleDeleteTask: () => void;
};

export function ProjectListItem({ project, users, onAddTask, onEditTask, onDeleteTask, taskToDelete, setTaskToDelete, handleDeleteTask }: ProjectListItemProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManageTasks = hasPermission('projects:update');
  
  const allTasks = (project.milestones || []).flatMap((m: any) => m.tasks || []);

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
      // Standard weighted calculation if there are weighted milestones
      return weightedMilestones.reduce((acc: number, milestone: any) => {
        const milestoneProgress = calculateMilestoneProgress(milestone);
        return acc + (milestoneProgress * (milestone.weight / 100));
      }, 0);
    } else {
      // If no weighted milestones, calculate based on task weights directly
      const allTasks = project.milestones.flatMap((m: any) => m.tasks);
      if (allTasks.length === 0) return 0;

      const totalTaskWeight = allTasks.reduce((sum: number, task: any) => sum + task.weight, 0);
      if (totalTaskWeight === 0) {
          // If tasks have no weight, calculate simple average of progress
          const totalProgress = allTasks.reduce((sum: number, task: any) => sum + (task.progress || 0), 0);
          return totalProgress / allTasks.length;
      }
      
      const totalWeightedTaskProgress = allTasks.reduce((acc: number, task: any) => {
        return acc + ((task.progress || 0) * task.weight);
      }, 0);

      return totalWeightedTaskProgress / totalTaskWeight;
    }
  };


  const handleAddTaskClick = () => {
    onAddTask(project);
  };

  const progress = calculateProjectProgress(project);
  const projectManager = users.find(u => u.id === project.projectManagerId);
  
  const team = project.teams?.[0]; // Assuming one team per project for this view
  const teamMembers = team?.members.map((m: User) => m.name).join(', ');
  
  return (
    <>
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <Link href={`/projects/${project.id}`}>
            <CardTitle className="text-xl font-bold hover:underline">{project.name}</CardTitle>
          </Link>
          <Badge variant="secondary" className="text-base whitespace-nowrap">{Math.round(progress)}% Done</Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground pt-2">
            <div className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                <span>Lead: {projectManager?.name ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{format(parseISO(project.startDate), "MMM d")} - {format(parseISO(project.endDate), "MMM d, yyyy")}</span>
            </div>
            {teamMembers && (
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="truncate max-w-xs">{teamMembers}</span>
                </div>
            )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex justify-between items-center">
            <h4 className="font-semibold text-card-foreground">Tasks</h4>
            {canManageTasks && (
                <Button variant="ghost" size="sm" onClick={handleAddTaskClick} disabled={project.milestones.length === 0}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Task
                </Button>
            )}
        </div>
        <div className="space-y-4">
            {allTasks.length > 0 ? allTasks.map((task: any) => (
                <div key={task.id} className="space-y-1 group">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{task.title}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Weight: {task.weight}%</span>
                            <span className="text-xs font-semibold text-muted-foreground">{task.progress || 0}%</span>
                            {canManageTasks && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                    <Progress value={task.progress || 0} className="h-2" />
                </div>
            )) : (
                 <div className="text-center text-sm text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                    No tasks yet for this project.
                </div>
            )}
        </div>
      </CardContent>
      {project.timelineChangeRequests?.length > 0 && (
          <CardFooter>
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
          </CardFooter>
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
        // Standard weighted calculation if there are weighted milestones
        return weightedMilestones.reduce((acc: number, milestone: any) => {
            const milestoneProgress = calculateMilestoneProgress(milestone);
            return acc + (milestoneProgress * (milestone.weight / 100));
        }, 0);
        } else {
        // If no weighted milestones, calculate based on task weights directly
        const allTasks = project.milestones.flatMap((m: any) => m.tasks);
        if (allTasks.length === 0) return 0;

        const totalTaskWeight = allTasks.reduce((sum: number, task: any) => sum + task.weight, 0);
        if (totalTaskWeight === 0) {
            // If tasks have no weight, calculate simple average of progress
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
