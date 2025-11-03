
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { ProjectStatus, User, Team, TaskUpdate } from "@/lib/types";
import { format, formatDistanceToNow, isSameMonth, isSameYear, parseISO } from "date-fns";
import { CheckCircle, XCircle, User as UserIcon, CalendarClock } from "lucide-react";
import { type ProjectWithTasksAndStats, type TeamViewTask } from "@/app/team-view/page";
import { approveTaskAction, declineTaskAction } from "@/app/team-view/actions";
import { Progress } from "../ui/progress";
import { DeclineTaskDialog } from "./decline-task-dialog";
import { cn } from "@/lib/utils";

const formatStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ').toLowerCase();

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
        const totalProgress = allTasks.reduce((sum: number, task: any) => sum + (task.progress || 0), 0);
        return allTasks.length > 0 ? totalProgress / allTasks.length : 0;
    }
    
    const totalWeightedTaskProgress = allTasks.reduce((acc: number, task: any) => {
    return acc + ((task.progress || 0) * task.weight);
    }, 0);

    return totalWeightedTaskProgress / totalTaskWeight;
}
};

const TaskCollapsible = ({
  task,
  userMap,
  onApprove,
  onDecline
}: {
  task: TeamViewTask,
  userMap: Map<string, User>,
  onApprove: (task: TeamViewTask) => void,
  onDecline: (task: TeamViewTask) => void,
}) => {
  const assignees = task.assignedUserIds.map(id => userMap.get(id)).filter(Boolean) as User[];
  
  return (
    <Card key={task.id} className={task.status === 'PENDING_REVIEW' ? 'border-primary' : ''}>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">{task.description}</p>
          <div className="space-y-2">
              <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-semibold">{task.progress || 0}%</span>
              </div>
              <Progress value={task.progress || 0} />
          </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Assignees:</span>
                <span>{assignees.map(a => a.name).join(', ')}</span>
            </div>
            <Badge variant="outline">Closing Date: {format(new Date(task.endDate), 'MMM dd, yyyy')}</Badge>
        </div>
        
        {task.updates && task.updates.length > 0 && (
          <>
            <Separator />
            <div>
                <h4 className="font-semibold mb-2 text-sm">Updates</h4>
                <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                    {task.updates.map(update => {
                        const author = userMap.get(update.authorId);
                        
                        if (update.type === 'STATUS_CHANGE') {
                            const isApproval = update.text.includes('approved');
                            return (
                                <div key={update.id} className="flex items-start gap-3">
                                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                        {isApproval ? (
                                            <CheckCircle className="w-6 h-6 text-green-500" />
                                        ) : (
                                            <XCircle className="w-6 h-6 text-destructive" />
                                        )}
                                    </div>
                                    <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold">{isApproval ? 'Task Approved' : 'Task Declined'}</span>
                                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</span>
                                        </div>
                                        <p className="text-muted-foreground italic">{update.text}</p>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={update.id} className="flex items-start gap-3">
                                <Avatar className="w-8 h-8 border">
                                    <AvatarImage src={author?.avatar} alt={author?.name} />
                                    <AvatarFallback>{author?.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold">{author?.name}</span>
                                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</span>
                                    </div>
                                    <p>{update.text}</p>
                                    {update.progressPercentage !== null && (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        Progress reported: <span className="font-bold">{update.progressPercentage}%</span>
                                      </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
          </>
        )}
        
        {task.status === 'PENDING_REVIEW' && (
            <>
                <Separator />
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onDecline(task)}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Decline
                    </Button>
                    <Button size="sm" onClick={() => onApprove(task)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                    </Button>
                </div>
            </>
        )}
      </CardContent>
    </Card>
  )
}

export function TeamTasksManagement({ allUsers, ledTeams, currentUser, initialTasksByProject, projectStatuses, onDataChange }: any) {
  const { toast } = useToast();
  const router = useRouter();
  const [taskToDecline, setTaskToDecline] = useState<TeamViewTask | null>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expandedStatusIds, setExpandedStatusIds] = useState<string[]>([]);

  const userMap = useMemo(() => new Map(allUsers.map((u: any) => [u.id, u])), [allUsers]);

  const { projectsByStatus, orderedStatuses, projectsClosingThisMonthCount, projectsClosingThisMonthIds } = useMemo(() => {
    if (!projectStatuses || !initialTasksByProject) return { projectsByStatus: {}, orderedStatuses: [], projectsClosingThisMonthCount: 0, projectsClosingThisMonthIds: [] };

    const statusOrder = ['Active', 'Pending', 'Parked', 'On Handover', 'Completed'];
    const statusIdToName = new Map(projectStatuses.map((s: any) => [s.id, s.name]));

    const grouped: Record<string, ProjectWithTasksAndStats[]> = {};
    const now = new Date();
    let closingThisMonthCount = 0;
    const closingIds: string[] = [];
    
    let projectsToDisplay = initialTasksByProject;
    
    initialTasksByProject.forEach((projectData: any) => {
        const closingDate = parseISO(projectData.project.endDate as unknown as string);
        if (isSameMonth(now, closingDate) && isSameYear(now, closingDate)) {
            closingThisMonthCount++;
            closingIds.push(projectData.project.id);
        }
    });

    if (activeFilter === 'closingThisMonth') {
        projectsToDisplay = initialTasksByProject.filter((projectData: any) => closingIds.includes(projectData.project.id));
    }

    projectsToDisplay.forEach((projectData: any) => {
        const statusName = statusIdToName.get(projectData.project.statusId || '') || 'Unknown';
        if (!grouped[statusName]) {
            grouped[statusName] = [];
        }
        grouped[statusName].push(projectData);
    });

    for (const status in grouped) {
      grouped[status].sort((a: any, b: any) => new Date(b.project.createdAt).getTime() - new Date(a.project.createdAt).getTime());
    }

    const finalOrderedStatuses = statusOrder.filter(status => grouped[status] && grouped[status].length > 0);
    
    Object.keys(grouped).forEach(statusName => {
        if (!finalOrderedStatuses.includes(statusName)) {
            finalOrderedStatuses.push(statusName);
        }
    });

    return { projectsByStatus: grouped, orderedStatuses: finalOrderedStatuses, projectsClosingThisMonthCount: closingThisMonthCount, projectsClosingThisMonthIds: closingIds };
  }, [initialTasksByProject, projectStatuses, activeFilter]);
  
  const handleApprove = async (task: TeamViewTask) => {
    const result = await approveTaskAction(task.id, currentUser.id, currentUser.name);
    if (result.success) {
      toast({ title: "Task Approved", description: `"${task.title}" has been reviewed.` });
      onDataChange();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };
  
  const handleDeclineConfirm = async (task: TeamViewTask, reason: string) => {
    const result = await declineTaskAction(task.id, currentUser.id, currentUser.name, reason);
     if (result.success) {
      toast({ title: "Task Declined", description: `"${task.title}" has been sent back to In Progress.`, variant: 'destructive' });
      onDataChange();
    } else {
       toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setTaskToDecline(null);
  };
  
  const toggleFilter = (filterName: string) => {
    const newFilter = activeFilter === filterName ? null : filterName;
    setActiveFilter(newFilter);

    if (newFilter === 'closingThisMonth') {
        const filteredProjects = initialTasksByProject.filter((p: any) => projectsClosingThisMonthIds.includes(p.project.id));
        const statusIdToName = new Map(projectStatuses.map((s: any) => [s.id, s.name]));
        const statusNames = new Set(filteredProjects.map((p: any) => statusIdToName.get(p.project.statusId)));
        setExpandedStatusIds(Array.from(statusNames) as string[]);
        setExpandedProjectIds([]); // Keep projects collapsed
    } else {
        setExpandedStatusIds([]);
        setExpandedProjectIds([]);
    }
    setExpandedTaskId(null);
  };

  const handleProjectAccordionChange = (value: string | string[]) => {
    if (Array.isArray(value)) {
        setExpandedProjectIds(value);
    } else {
        setExpandedProjectIds(value ? [value] : []);
    }
    setExpandedTaskId(null);
  };
  
  if (ledTeams.length === 0) {
    return (
        <div className="p-4 sm:p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Team Task View</CardTitle>
                    <CardDescription>
                        Review and manage tasks assigned to your team members. You can approve or decline work that is pending review.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p className="text-lg font-semibold">You are not leading any teams.</p>
                        <p>This view is for team leads to manage their team's tasks.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Task View</CardTitle>
            <CardDescription>
              Review and manage tasks assigned to your team members. You can approve or decline work that is pending review.
            </CardDescription>
          </CardHeader>
           <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Your Teams</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{ledTeams.length}</div>
                      </CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Projects Involved In</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{initialTasksByProject.length}</div>
                      </CardContent>
                  </Card>
                   <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{initialTasksByProject.reduce((acc: number, p: any) => acc + p.stats.pending, 0)}</div>
                      </CardContent>
                  </Card>
                  <Card
                    className={cn(
                        'cursor-pointer transition-colors',
                        activeFilter === 'closingThisMonth' ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleFilter('closingThisMonth')}
                   >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Closing This Month</CardTitle>
                           <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{projectsClosingThisMonthCount}</div>
                      </CardContent>
                  </Card>
              </div>
          </CardContent>
        </Card>
        
        {initialTasksByProject.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-card">
                <p className="text-lg font-semibold">No tasks assigned to your team members.</p>
                <p>Once tasks are assigned, they will appear here for you to manage.</p>
            </div>
        ) : (
          <Accordion type="multiple" className="w-full space-y-4" value={expandedStatusIds} onValueChange={setExpandedStatusIds}>
            {orderedStatuses.map(statusName => {
                const projects = projectsByStatus[statusName];
                if (!projects || projects.length === 0) {
                    return null;
                }
                return (
                    <AccordionItem value={statusName} key={statusName} className="border-none">
                        <Card>
                            <AccordionTrigger className="p-4 text-lg hover:no-underline font-semibold">
                                {statusName} Projects ({projects.length})
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                <Accordion type="multiple" className="w-full space-y-4" value={expandedProjectIds} onValueChange={handleProjectAccordionChange}>
                                    {projects.map(({ project, tasks, stats }: ProjectWithTasksAndStats) => {
                                        const projectProgress = calculateProjectProgress(project);
                                        const completedStatusNames = ['Completed', 'On Handover'];
                                        
                                        const isClosingThisMonth = isSameMonth(new Date(), parseISO(project.endDate as unknown as string)) && isSameYear(new Date(), parseISO(project.endDate as unknown as string));

                                        let statusBadge;
                                        const isProjectClosed = completedStatusNames.includes(statusName);
                                        const allTasksDone = stats.done === stats.total && stats.total > 0;

                                        if (isProjectClosed) {
                                            statusBadge = <Badge className="bg-zinc-500 hover:bg-zinc-500/90 text-primary-foreground">Closed</Badge>;
                                        } else if (stats.pending > 0) {
                                            statusBadge = <Badge className="bg-amber-500 hover:bg-amber-500/90 text-primary-foreground">Pending Review</Badge>;
                                        } else if (allTasksDone && Math.round(projectProgress) >= 100) {
                                            statusBadge = <Badge className="bg-green-600 hover:bg-green-600/90 text-primary-foreground">Ready to Close</Badge>;
                                        } else if (allTasksDone) {
                                            statusBadge = <Badge className="bg-sky-600 hover:bg-sky-600/90 text-primary-foreground">All Tasks Done</Badge>;
                                        } else {
                                            statusBadge = <Badge className="bg-primary hover:bg-primary/90">Active</Badge>;
                                        }
                                      
                                      return (
                                      <AccordionItem value={project.id} key={project.id} className="border rounded-lg bg-background">
                                        <AccordionTrigger className="p-4 hover:no-underline">
                                          <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
                                              <div className="flex-1 text-left space-y-1">
                                                <p className="font-semibold">{project.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-muted-foreground">Closing Date: {format(parseISO(project.endDate as unknown as string), 'MMM dd, yyyy')}</p>
                                                    {isClosingThisMonth && (
                                                        <Badge variant="destructive" className="flex items-center gap-1">
                                                            <CalendarClock className="w-3 h-3" /> Closing Soon
                                                        </Badge>
                                                    )}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-3 w-full md:w-auto md:min-w-[300px]">
                                                  <Progress value={projectProgress} className="h-2 flex-1" />
                                                  <span className="text-sm font-semibold w-12 text-right">{Math.round(projectProgress)}%</span>
                                                  {statusBadge}
                                                  <Badge variant="outline">Tasks: ({stats.done}/{stats.total})</Badge>
                                              </div>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-4 pt-0">
                                           {tasks.length > 0 ? (
                                             <Accordion type="single" collapsible className="w-full space-y-2" value={expandedTaskId || ""} onValueChange={(value) => setExpandedTaskId(value || null)}>
                                              {tasks.sort((a: TeamViewTask, b: TeamViewTask) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((task: TeamViewTask) => (
                                                <AccordionItem value={task.id} key={task.id} className="border rounded-md px-4 bg-muted/50">
                                                    <AccordionTrigger className="hover:no-underline">
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex-1 text-left">
                                                                <p className="font-semibold">{task.title}</p>
                                                                <p className="text-sm text-muted-foreground">{formatStatus(task.status)}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 mr-4">
                                                                <Badge variant="secondary" className={task.status === 'PENDING_REVIEW' ? 'bg-primary text-primary-foreground' : ''}>
                                                                    {task.status === 'PENDING_REVIEW' ? 'Action Required' : `${task.progress || 0}%`}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-2 pb-4">
                                                        <TaskCollapsible
                                                            task={task}
                                                            userMap={userMap}
                                                            onApprove={handleApprove}
                                                            onDecline={setTaskToDecline}
                                                        />
                                                    </AccordionContent>
                                                </AccordionItem>
                                              ))}
                                            </Accordion>
                                          ) : (
                                              <p className="text-muted-foreground text-sm pl-2">No tasks assigned to your team members for this project.</p>
                                          )}
                                        </AccordionContent>
                                      </AccordionItem>
                                      )
                                    })}
                                </Accordion>
                            </AccordionContent>
                        </Card>
                    </AccordionItem>
                )
            })}
          </Accordion>
        )}
        
        {taskToDecline && (
          <DeclineTaskDialog
            isOpen={!!taskToDecline}
            onOpenChange={(open) => !open && setTaskToDecline(null)}
            task={taskToDecline}
            onDeclineConfirm={(reason) => handleDeclineConfirm(taskToDecline, reason)}
          />
        )}
      </div>
    </>
  );
}
