"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronDown, CheckSquare, Edit, Eye, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { endOfDay, isAfter, isToday, parseISO } from 'date-fns';

import { Badge } from '../ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

/**
 * The expandable tasks panel on a project card.
 *
 * Lifted out of project-card.tsx, which was nearly five hundred lines. The
 * derived task lists and the milestone filter came with it: the filter is a
 * display choice belonging to this panel, and keeping its state in the card
 * meant every keystroke re-rendered the header and the teams panel too.
 */
export function ProjectCardTasks({
  project,
  isTasksExpanded,
  onExpandToggle,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  project: any;
  isTasksExpanded: boolean;
  onExpandToggle: (projectId: string, section: 'tasks' | 'teams') => void;
  onAddTask: (project: any) => void;
  onEditTask: (task: any, project: any) => void;
  onDeleteTask: (task: any) => void;
}) {
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
          <div className="space-y-3">
            <div 
                className="flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors" 
                onClick={(e) => {
                    e.stopPropagation();
                    onExpandToggle(project.id, 'tasks');
                }}
            >
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-green-600" />
                  <h4 className="font-semibold text-green-700">Tasks ({completedTasksCount}/{allTasks.length})</h4>
                </div>
                <div className="flex items-center gap-2">
                    {canManageTasks && (
                        <Button variant="secondary" size="sm" onClick={handleAddTaskClick}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Task
                        </Button>
                    )}
                    <div className="cursor-pointer p-1">
                        <ChevronDown className={cn("h-5 w-5 transition-transform text-green-600", isTasksExpanded && "rotate-180")} />
                    </div>
                </div>
            </div>
          
          {isTasksExpanded && (
            <div className="ml-6 space-y-3 border-l-2 border-green-200 pl-4">
              {allTasks.length > 0 ? (
                <Tabs defaultValue="today" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="today">Today's Tasks ({completedTodaysTasksCount}/{todaysTasks.length})</TabsTrigger>
                        <TabsTrigger value="other">Other Tasks ({completedOtherTasksCount}/{otherTasks.length})</TabsTrigger>
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
  );
}
