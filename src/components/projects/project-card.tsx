

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
import { isOpenBlocker } from '@/lib/validation/blocker';
import { ProjectCardTeams } from './project-card-teams';
import { ProjectCardTasks } from './project-card-tasks';
import {
  displayProgress,
  isArchivedStatus,
  isOverdue,
  milestoneProgress as calculateMilestoneProgress,
  projectProgress as calculateProjectProgress,
} from '@/lib/metrics';
import { daysUntil, projectRisks } from '@/lib/ui/health';
import { ProjectHealthyBadge, ProjectRiskBadge } from './project-summary';

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
  isTasksExpanded: boolean;
  isTeamsExpanded: boolean;
  onExpandToggle: (projectId: string, section: 'tasks' | 'teams') => void;
};

const ProgressBadge = ({ progress, isOverdue }: { progress: number, isOverdue: boolean }) => {
    const isComplete = progress >= 100;
    /*
     * Each fill brings its own label colour. They all used to take
     * `text-primary-foreground`, which is the black that pairs with gold — on
     * the green and red fills that is a black label on a dark ground.
     */
    const tone = isComplete
      ? 'bg-success text-success-foreground'
      : isOverdue
        ? 'bg-destructive text-destructive-foreground'
        : 'bg-primary text-primary-foreground';

    return (
      <div className={cn(
        "relative inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-6",
        tone
      )}>
        {/*
          The fill indicator tracks the label colour rather than being a fixed
          white wash, so it stays visible on the light gold badge as well as on
          the dark green and red ones.
        */}
        <div className="absolute left-0 top-0 h-full rounded-full bg-current opacity-20" style={{ width: `${progress}%` }}/>
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
    handleDeleteTeam,
    isTasksExpanded,
    isTeamsExpanded,
    onExpandToggle,
}: ProjectListItemProps) {
  const { hasPermission } = useAuth();
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | 'all'>('all');

  const canManageTasks = hasPermission('projects:update');
  
  const userCreatedMilestones = (project.milestones || []).filter((m: any) => m.title !== 'General Tasks');
  
  const allTasks = useMemo(() => 
    (project.milestones || []).flatMap((m: any) => m.tasks || [])
  , [project.milestones]);

  const completedTasksCount = useMemo(() =>
    allTasks.filter((task: any) => task.status === 'DONE').length
  , [allTasks]);

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

    todays.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    others.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return { todaysTasks: todays, otherTasks: others };
  }, [allTasks]);

  const completedTodaysTasksCount = useMemo(() =>
    todaysTasks.filter((task: any) => task.status === 'DONE').length
  , [todaysTasks]);

  const completedOtherTasksCount = useMemo(() =>
    otherTasks.filter((task: any) => task.status === 'DONE').length
  , [otherTasks]);

  const filteredTasks = selectedMilestoneId === 'all' 
    ? otherTasks 
    : project.milestones.find((m: any) => m.id === selectedMilestoneId)?.tasks.filter((t: any) => !todaysTasks.some(tt => tt.id === t.id)).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];
  

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
  
  /*
   * Was a hard-coded list of status *names* — ['Active', 'Pending', 'Parked'] —
   * which is the exact failure the metrics module exists to prevent: statuses
   * are renameable in Settings, so renaming "Parked" to "On hold" silently
   * stopped those projects ever reading as overdue. `isOverdue` decides from
   * the immutable category and applies the same end-of-day boundary the
   * dashboard and the reports use.
   */
  const isProjectOverdue = isOverdue(project);
  const openBlockersCount = project.blockers?.length || 0;
  
  const TaskRow = ({task}: {task: any}) => {
    const isTaskDone = task.status === 'DONE';
    const isTaskOverdue = isAfter(new Date(), endOfDay(parseISO(task.endDate))) && !isTaskDone;
    const indicatorClassName = isTaskDone ? 'bg-success' : isTaskOverdue ? 'bg-destructive' : 'bg-primary';

    return (
        <div key={task.id} className="space-y-1.5 group">
            <div className="flex justify-between items-center gap-2">
              <div className="flex-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/*
                      `max-w-14` is 3.5rem — about four characters — so every
                      task in this list rendered as an ellipsis and a tooltip.
                      The row already constrains the width; truncate alone does
                      the job.
                    */}
                    <p className="block truncate pr-2 text-sm font-medium">
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
                  <span>Closing Date: {format(parseISO(project.endDate), "MMM d, yyyy")}</span>
              </div>
          </div>
        </CardHeader>

        <CardContent className="flex-grow flex flex-col justify-end pt-0">
          <Separator className="mb-4" />
          
          {/* Teams and tasks each own their markup; see the two components. */}
          <ProjectCardTeams
            project={project}
            isTeamsExpanded={isTeamsExpanded}
            onExpandToggle={onExpandToggle}
            canManageTeams={canManageTeams}
            onAddTeam={onAddTeam}
            onEditTeam={onEditTeam}
            onDeleteTeam={onDeleteTeam}
          />

          <Separator className="my-4" />

          <ProjectCardTasks
            project={project}
            isTasksExpanded={isTasksExpanded}
            onExpandToggle={onExpandToggle}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
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

/**
 * A project as a card, for the report grids and the archive.
 *
 * It used to carry a name, a description, a progress bar, a status and a date —
 * and a red "Blocker" badge that fired for any open issue, however trivial. So
 * a project with one low-severity question outstanding looked exactly as alarming
 * as one three weeks past its deadline with a critical issue unowned.
 *
 * The badge is now the project's worst actual risk, which distinguishes those
 * two, and says on hover why it is flagged. A project with nothing wrong says
 * so, rather than saying nothing.
 */
export function ProjectCard({ project, href }: { project: any, href?: string }) {

    const progress = calculateProjectProgress(project);
    const remaining = daysUntil({ endDate: project.endDate });
    const closed = isArchivedStatus(project.status);
    const risk = closed ? null : projectRisks(project)[0];

    return (
      <Link
        href={href || `/projects/${project.id}`}
        className="group h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Card className="flex h-full flex-col transition-shadow group-hover:shadow-md">
            <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 truncate text-base">{project.name}</CardTitle>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {risk ? <ProjectRiskBadge project={project} /> : !closed ? <ProjectHealthyBadge /> : null}
                </div>
                <CardDescription className="line-clamp-2">{project.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                 <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium tabular-nums">{displayProgress(progress)}%</span>
                    </div>
                    <Progress
                      value={progress}
                      aria-label={`${project.name}: ${displayProgress(progress)}% complete`}
                    />
                </div>
            </CardContent>
            <CardFooter className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{project.status?.name}</span>
                <span>
                  {closed || remaining === null
                    ? `Closed ${format(parseISO(project.endDate), 'd MMM yyyy')}`
                    : remaining < 0
                      ? `${Math.abs(remaining)} days overdue`
                      : `Due ${format(parseISO(project.endDate), 'd MMM yyyy')}`}
                </span>
            </CardFooter>
        </Card>
      </Link>
    )
}
