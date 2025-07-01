
"use client";

import { useState, useMemo } from "react";
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
import type { Project, Task, User, Team, TaskUpdate } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, User as UserIcon } from "lucide-react";

type TeamTasksManagementProps = {
  allProjects: Project[];
  allUsers: User[];
  allTeams: Team[];
  currentUser: User;
};

type UserTask = Task & {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TeamTasksManagement({ allProjects, allUsers, allTeams, currentUser }: TeamTasksManagementProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>(allProjects);
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

  const ledTeams = useMemo(() => {
    return allTeams.filter(team => team.teamLeadId === currentUser.id);
  }, [allTeams, currentUser.id]);

  const teamMemberIds = useMemo(() => {
    return new Set(ledTeams.flatMap(team => team.memberIds));
  }, [ledTeams]);
  
  const teamTasksByProject = useMemo(() => {
    const tasksByProject: Record<string, UserTask[]> = {};

    projects.forEach(project => {
      project.milestones.forEach(milestone => {
        milestone.tasks.forEach(task => {
          if (task.assignedUserIds.some(userId => teamMemberIds.has(userId))) {
            if (!tasksByProject[project.name]) {
              tasksByProject[project.name] = [];
            }
            tasksByProject[project.name].push({
              ...task,
              projectId: project.id,
              projectName: project.name,
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
            });
          }
        });
      });
    });
    return tasksByProject;
  }, [projects, teamMemberIds]);

  const handleApprove = (task: UserTask) => {
    const updateText = `Task approved by ${currentUser.name}. Status changed to Done.`;
    const newUpdate: TaskUpdate = {
      id: `update-${Date.now()}`,
      text: updateText,
      userId: currentUser.id,
      createdAt: new Date().toISOString(),
      type: 'status-change',
    };

    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === task.projectId
          ? {
              ...p,
              milestones: p.milestones.map(m =>
                m.id === task.milestoneId
                  ? {
                      ...m,
                      tasks: m.tasks.map(t =>
                        t.id === task.id ? { ...t, status: 'done', updates: [...(t.updates || []), newUpdate] } : t
                      ),
                    }
                  : m
              ),
            }
          : p
      )
    );
    toast({ title: "Task Approved", description: `"${task.title}" has been marked as Done.` });
  };
  
  const handleDecline = (task: UserTask) => {
    const updateText = `Task declined by ${currentUser.name}. Status changed back to In Progress.`;
    const newUpdate: TaskUpdate = {
      id: `update-${Date.now()}`,
      text: updateText,
      userId: currentUser.id,
      createdAt: new Date().toISOString(),
      type: 'status-change',
    };
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === task.projectId
          ? {
              ...p,
              milestones: p.milestones.map(m =>
                m.id === task.milestoneId
                  ? {
                      ...m,
                      tasks: m.tasks.map(t =>
                        t.id === task.id ? { ...t, status: 'in-progress', updates: [...(t.updates || []), newUpdate] } : t
                      ),
                    }
                  : m
              ),
            }
          : p
      )
    );
    toast({ title: "Task Declined", description: `"${task.title}" has been sent back to In Progress.`, variant: 'destructive' });
  };


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

      <Accordion type="multiple" className="w-full space-y-4" defaultValue={Object.keys(teamTasksByProject)}>
        {Object.entries(teamTasksByProject).map(([projectName, tasks]) => (
          <AccordionItem value={projectName} key={projectName} className="border rounded-lg bg-card">
            <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
              {projectName}
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
              <div className="space-y-4">
                {tasks.map(task => {
                    const assignees = task.assignedUserIds.map(id => userMap.get(id)).filter(Boolean) as User[];
                    return (
                        <Card key={task.id} className={task.status === 'pending-review' ? 'border-primary' : ''}>
                            <CardHeader>
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <CardTitle className="text-xl">{task.title}</CardTitle>
                                        <CardDescription>In Milestone: {task.milestoneTitle}</CardDescription>
                                    </div>
                                    <Badge variant={task.status === 'done' ? 'default' : 'secondary'}>
                                        {capitalize(task.status.replace('-', ' '))}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-muted-foreground">{task.description}</p>
                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium">Assignees:</span>
                                        <span>{assignees.map(a => a.name).join(', ')}</span>
                                    </div>
                                    <Badge variant="outline">Due: {format(new Date(task.endDate), 'MMM dd, yyyy')}</Badge>
                                </div>
                                {task.updates && task.updates.length > 0 && (
                                     <>
                                        <Separator />
                                        <div>
                                            <h4 className="font-semibold mb-2 text-sm">Latest Update</h4>
                                            <div className="flex items-start gap-3">
                                                <Avatar className="w-8 h-8 border">
                                                    <AvatarImage src={userMap.get(task.updates[task.updates.length - 1].userId)?.avatar} />
                                                    <AvatarFallback>{userMap.get(task.updates[task.updates.length - 1].userId)?.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold">{userMap.get(task.updates[task.updates.length - 1].userId)?.name}</span>
                                                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(task.updates[task.updates.length - 1].createdAt), { addSuffix: true })}</span>
                                                    </div>
                                                    <p>{task.updates[task.updates.length - 1].text}</p>
                                                </div>
                                            </div>
                                        </div>
                                     </>
                                )}
                                {task.status === 'pending-review' && (
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
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
       {ledTeams.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-semibold">You are not leading any teams.</p>
            <p>This view is for team leads to manage their team's tasks.</p>
        </div>
      )}
       {ledTeams.length > 0 && Object.keys(teamTasksByProject).length === 0 && (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-semibold">No tasks assigned to your team members.</p>
            <p>Once tasks are assigned, they will appear here for you to manage.</p>
        </div>
      )}
    </div>
  );
}
