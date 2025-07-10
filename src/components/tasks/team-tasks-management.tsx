
"use client";

import { useMemo } from "react";
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
import type { ProjectStatus, User, Team } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, User as UserIcon } from "lucide-react";
import { type ProjectWithTasksAndStats, type TeamViewTask } from "@/app/team-view/page";
import { approveTaskAction, declineTaskAction } from "@/app/team-view/actions";
import { Progress } from "../ui/progress";

type TeamTasksManagementProps = {
  allUsers: User[];
  ledTeams: Team[];
  currentUser: User;
  initialTasksByProject: ProjectWithTasksAndStats[];
  projectStatuses: ProjectStatus[];
};

const formatStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ').toLowerCase();

export function TeamTasksManagement({ allUsers, ledTeams, currentUser, initialTasksByProject, projectStatuses }: TeamTasksManagementProps) {
  const { toast } = useToast();
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

  const sortedProjects = useMemo(() => {
    if (!projectStatuses || !initialTasksByProject) return [];
    
    const completedStatusId = projectStatuses.find(s => s.name === 'Completed')?.id;
    return [...initialTasksByProject].sort((a, b) => {
        const aIsCompleted = a.project.statusId === completedStatusId;
        const bIsCompleted = b.project.statusId === completedStatusId;
        if (aIsCompleted && !bIsCompleted) return 1;
        if (!aIsCompleted && bIsCompleted) return -1;
        return a.project.name.localeCompare(b.project.name);
    });
  }, [initialTasksByProject, projectStatuses]);

  const handleApprove = async (task: TeamViewTask) => {
    const result = await approveTaskAction(task.id, currentUser.id, currentUser.name);
    if (result.success) {
      toast({ title: "Task Approved", description: `"${task.title}" has been marked as Done.` });
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };
  
  const handleDecline = async (task: TeamViewTask) => {
    const result = await declineTaskAction(task.id, currentUser.id, currentUser.name);
     if (result.success) {
      toast({ title: "Task Declined", description: `"${task.title}" has been sent back to In Progress.`, variant: 'destructive' });
    } else {
       toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };
  
  const defaultOpenProjects = useMemo(() => {
    if (!projectStatuses) return [];
    const completedStatusId = projectStatuses.find(s => s.name === 'Completed')?.id;
    return sortedProjects
      .filter(({ project }) => project.statusId !== completedStatusId)
      .map(({ project }) => project.id);
  }, [sortedProjects, projectStatuses]);


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
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Task View</CardTitle>
          <CardDescription>
            Review and manage tasks assigned to your team members. You can approve or decline work that is pending review.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {initialTasksByProject.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-card">
              <p className="text-lg font-semibold">No tasks assigned to your team members.</p>
              <p>Once tasks are assigned, they will appear here for you to manage.</p>
          </div>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={defaultOpenProjects}>
          {sortedProjects.map(({ project, tasks, stats }) => {
              const completedStatusId = projectStatuses.find(s => s.name === 'Completed')?.id;
              
              let statusBadge;
              if (project.statusId === completedStatusId) {
                  statusBadge = <Badge className="bg-zinc-500 hover:bg-zinc-500/90 text-primary-foreground">Closed</Badge>;
              } else if (stats.pending > 0) {
                  statusBadge = <Badge className="bg-amber-500 hover:bg-amber-500/90 text-primary-foreground">Pending Review</Badge>;
              } else if (stats.inProgress > 0 || stats.todo > 0) {
                  statusBadge = <Badge className="bg-blue-500 hover:bg-blue-500/90 text-primary-foreground">Active</Badge>;
              } else if (stats.total > 0) {
                  statusBadge = <Badge className="bg-green-600 hover:bg-green-600/90 text-primary-foreground">Completed</Badge>;
              } else {
                  statusBadge = <Badge variant="secondary">No Team Tasks</Badge>;
              }
            
            return (
            <AccordionItem value={project.id} key={project.id} className="border rounded-lg bg-card">
              <AccordionTrigger className="p-4 text-lg hover:no-underline">
                  <div className="flex justify-between items-center w-full">
                      <span className="font-semibold">{project.name}</span>
                      <div className="flex items-center gap-2 mr-4">
                          {statusBadge}
                          <Badge variant="outline">Team Tasks: {stats.total}</Badge>
                      </div>
                  </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <div className="space-y-4">
                  {tasks.length > 0 ? tasks.sort((a, b) => a.title.localeCompare(b.title)).map(task => {
                      const assignees = task.assignedUserIds.map(id => userMap.get(id)).filter(Boolean) as User[];
                      const latestUpdate = task.updates && task.updates.length > 0 ? [...task.updates].reverse().find(u => u.type === 'COMMENT') : null;
                      const latestUpdateAuthor = latestUpdate ? userMap.get(latestUpdate.authorId) : null;
                      return (
                          <Card key={task.id} className={task.status === 'PENDING_REVIEW' ? 'border-primary' : ''}>
                              <CardHeader>
                                  <div className="flex justify-between items-start gap-4">
                                      <div>
                                          <CardTitle className="text-xl">{task.title}</CardTitle>
                                          <CardDescription>In Milestone: {task.milestoneTitle}</CardDescription>
                                      </div>
                                      <Badge variant={task.status === 'DONE' ? 'default' : 'secondary'}>
                                          {formatStatus(task.status)}
                                      </Badge>
                                  </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
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
                                      <Badge variant="outline">Due: {format(new Date(task.endDate), 'MMM dd, yyyy')}</Badge>
                                  </div>
                                  {latestUpdate && (
                                       <>
                                          <Separator />
                                          <div>
                                              <h4 className="font-semibold mb-2 text-sm">Latest Update</h4>
                                              <div className="flex items-start gap-3">
                                                  <Avatar className="w-8 h-8 border">
                                                      <AvatarImage src={latestUpdateAuthor?.avatar} />
                                                      <AvatarFallback>{latestUpdateAuthor?.name.charAt(0)}</AvatarFallback>
                                                  </Avatar>
                                                  <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                                      <div className="flex justify-between items-center mb-1">
                                                          <span className="font-semibold">{latestUpdateAuthor?.name}</span>
                                                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(latestUpdate.createdAt), { addSuffix: true })}</span>
                                                      </div>
                                                      <p>{latestUpdate.text}</p>
                                                      {latestUpdate.progressPercentage !== null && (
                                                        <div className="mt-2 text-xs font-semibold text-primary">
                                                            {latestUpdate.progressPercentage}%
                                                        </div>
                                                      )}
                                                  </div>
                                              </div>
                                          </div>
                                       </>
                                  )}
                                  {task.status === 'PENDING_REVIEW' && (
                                      <>
                                          <Separator />
                                          <div className="flex justify-end gap-2">
                                              <Button variant="outline" size="sm" onClick={() => handleDecline(task)}>
                                                  <XCircle className="mr-2 h-4 w-4" />
                                                  Decline
                                              </Button>
                                              <Button size="sm" onClick={() => handleApprove(task)}>
                                                  <CheckCircle className="mr-2 h-4 w-4" />
                                                  Approve
                                              </Button>
                                          </div>
                                      </>
                                  )}
                              </CardContent>
                          </Card>
                      )
                  }) : (
                      <p className="text-muted-foreground text-sm pl-2">No tasks assigned to your team members for this project.</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  );
}
