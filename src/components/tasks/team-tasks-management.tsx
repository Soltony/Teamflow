
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
import { CheckCircle, XCircle, User as UserIcon, CalendarClock, AlertTriangle } from "lucide-react";
import { type ProjectWithTasksAndStats, type TeamViewTask } from "@/app/team-view/page";
import { approveTaskAction, declineTaskAction } from "@/app/team-view/actions";
import { Progress } from "../ui/progress";
import { DeclineTaskDialog } from "./decline-task-dialog";
import { TaskWorkspace } from "./my-tasks-views";
import type { TaskLike } from "./task-views";
import { cn } from "@/lib/utils";
import {
  isArchivedStatus,
  milestoneProgress as calculateMilestoneProgress,
  projectProgress as calculateProjectProgress,
  statusCategory,
  type StatusCategory,
} from '@/lib/metrics';

/**
 * The order status groups are shown in: live work first, finished work last.
 *
 * Keyed on the immutable category rather than on status names. The previous
 * version listed the five seeded names literally, so renaming any status in
 * Settings dropped its whole group to the bottom of the page — and renaming
 * "Completed" also stopped its projects being badged as closed.
 */
const CATEGORY_ORDER: Record<StatusCategory, number> = {
  ACTIVE: 0,
  ON_HOLD: 1,
  HANDOVER: 2,
  CLOSED: 3,
  UNKNOWN: 4,
};

const formatStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ').toLowerCase();

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
                                    <AvatarImage src={author?.avatar ?? undefined} alt={author?.name} />
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
  const [expandedStatusId, setExpandedStatusId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const userMap = useMemo(
    () => new Map<string, User>(allUsers.map((u: any) => [u.id as string, u as User])),
    [allUsers],
  );

  /**
   * The status row behind each id.
   *
   * The projects in this view carry `statusId` but not the status relation, so
   * anything that needs the *category* — which is the only safe basis for
   * deciding whether a project is finished — has to look it up here.
   */
  /**
   * Every task the reader's teams are carrying, flattened.
   *
   * The workspace is shared with My tasks, so both screens agree on what
   * counts as overdue and how grouping behaves.
   */
  const workspaceTasks: TaskLike[] = useMemo(
    () =>
      (initialTasksByProject ?? []).flatMap((entry: ProjectWithTasksAndStats) =>
        entry.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status as string,
          endDate: task.endDate as unknown as string,
          progress: task.progress ?? 0,
          projectId: entry.project.id,
          projectName: entry.project.name,
          milestoneTitle: task.milestoneTitle,
          assigneeNames: task.assignedUserIds
            .map((id: string) => userMap.get(id)?.name)
            .filter(Boolean) as string[],
        })),
      ),
    [initialTasksByProject, userMap],
  );

  const statusById = useMemo(
    () => new Map<string, any>((projectStatuses ?? []).map((s: any) => [s.id as string, s])),
    [projectStatuses],
  );

  const { projectsByStatus, orderedStatuses, projectsClosingThisMonthCount, projectsWithPendingApprovalsCount, projectsClosingThisMonthIds, projectsWithPendingApprovalsIds } = useMemo(() => {
    if (!projectStatuses || !initialTasksByProject) return { projectsByStatus: {}, orderedStatuses: [], projectsClosingThisMonthCount: 0, projectsWithPendingApprovalsCount: 0, projectsClosingThisMonthIds: [], projectsWithPendingApprovalsIds: [] };

    const statusIdToName = new Map<string, string>(
      projectStatuses.map((s: any) => [s.id as string, s.name as string]),
    );
    // Name → the status row, so the group heading can still read as the name
    // while the ordering and the closed test use the category behind it.
    const statusByName = new Map<string, any>(
      projectStatuses.map((s: any) => [s.name as string, s]),
    );

    let closingThisMonthCount = 0;
    const closingIds: string[] = [];
    let pendingApprovalsCount = 0;
    const pendingIds: string[] = [];
    
    let projectsToDisplay = initialTasksByProject;
    
    initialTasksByProject.forEach((projectData: any) => {
        const closingDate = parseISO(projectData.project.endDate as unknown as string);
        const now = new Date();
        if (isSameMonth(now, closingDate) && isSameYear(now, closingDate)) {
            closingThisMonthCount++;
            closingIds.push(projectData.project.id);
        }
        if (projectData.stats.pending > 0) {
            pendingApprovalsCount++;
            pendingIds.push(projectData.project.id);
        }
    });

    if (activeFilter === 'closingThisMonth') {
        projectsToDisplay = initialTasksByProject.filter((projectData: any) => closingIds.includes(projectData.project.id));
    } else if (activeFilter === 'pendingApprovals') {
        projectsToDisplay = initialTasksByProject.filter((projectData: any) => pendingIds.includes(projectData.project.id));
    }
    
    const grouped: Record<string, ProjectWithTasksAndStats[]> = {};
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

    // Live work first, finished work last, alphabetical within a category so
    // two statuses of the same kind keep a stable order.
    const finalOrderedStatuses = Object.keys(grouped).sort((a, b) => {
        const rankA = CATEGORY_ORDER[statusCategory(statusByName.get(a) ?? a)];
        const rankB = CATEGORY_ORDER[statusCategory(statusByName.get(b) ?? b)];
        return rankA - rankB || a.localeCompare(b);
    });

    return { 
        projectsByStatus: grouped, 
        orderedStatuses: finalOrderedStatuses, 
        projectsClosingThisMonthCount: closingThisMonthCount, 
        projectsWithPendingApprovalsCount: pendingApprovalsCount,
        projectsClosingThisMonthIds: closingIds,
        projectsWithPendingApprovalsIds: pendingIds,
    };
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

    if (newFilter) {
      let idsToFilter: string[] = [];
      if (newFilter === 'closingThisMonth') idsToFilter = projectsClosingThisMonthIds;
      if (newFilter === 'pendingApprovals') idsToFilter = projectsWithPendingApprovalsIds;
      
      const relevantStatusNames = new Set(
        initialTasksByProject
          .filter((p: any) => idsToFilter.includes(p.project.id))
          .map((p: any) => projectStatuses.find((s:any) => s.id === p.project.statusId)?.name)
      );
      const firstMatchingStatus = orderedStatuses.find(status => relevantStatusNames.has(status));
      setExpandedStatusId(firstMatchingStatus || null);
    } else {
      setExpandedStatusId(null);
    }
    
    setExpandedProjectId(null);
    setExpandedTaskId(null);
  };

  const handleStatusAccordionChange = (value: string) => {
    setExpandedStatusId(prevId => (prevId === value ? null : value));
    setExpandedProjectId(null); 
    setExpandedTaskId(null);
  };

  const handleProjectAccordionChange = (value: string) => {
    setExpandedProjectId(prevId => (prevId === value ? null : value));
    setExpandedTaskId(null);
  };

  const handleTaskAccordionChange = (value: string) => {
    setExpandedTaskId(prevId => (prevId === value ? null : value));
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Projects Involved In</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{initialTasksByProject.length}</div>
                      </CardContent>
                  </Card>
                   <Card 
                     className={cn(
                        'cursor-pointer transition-colors',
                        activeFilter === 'pendingApprovals' ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                     )}
                     onClick={() => toggleFilter('pendingApprovals')}
                   >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{projectsWithPendingApprovalsCount}</div>
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

        {/*
          The accordion this replaces nested status → project → task, so seeing
          one team member's work meant opening three levels in every project
          they touch. The workspace shows the same tasks in whichever shape the
          question needs, and review decisions live where they belong — in the
          approvals inbox, and on the task itself.
        */}
        <TaskWorkspace
          tasks={workspaceTasks}
          onDataChange={onDataChange}
          storageKey="team-view"
          emptyTitle="No tasks assigned to your team"
          emptyDescription="Once work is assigned to somebody you lead, it appears here."
        />

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
