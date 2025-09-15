
'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { getMilestonesPageData } from './actions';
import { Skeleton } from "@/components/ui/skeleton";
import type { Project, Milestone, Department, Role, Task } from "@prisma/client";
import { Progress } from "@/components/ui/progress";

type ProjectWithMilestones = Project & {
    milestones: (Milestone & { tasks: Task[] })[],
    responsibleDepartments: Department[],
}

function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96 mt-2" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function AllMilestonesPage() {
  const { localUser, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectWithMilestones[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      if (localUser?.id) {
          setIsLoading(true);
          getMilestonesPageData(localUser.id).then(data => {
              setProjects(data);
              setIsLoading(false);
          });
      } else if (!authLoading) {
          setIsLoading(false);
      }
  }, [localUser, authLoading]);

  if (isLoading || authLoading) {
      return <LoadingSkeleton />;
  }

  if (!localUser) {
    return (
        <div className="p-4 sm:p-6">
            <p>Could not load milestones. Please try logging in again.</p>
        </div>
    )
  }
  
  const calculateMilestoneProgress = (milestone: Milestone & { tasks: Task[] }) => {
    if (!milestone.tasks || milestone.tasks.length === 0) return 0;
    const completedTaskWeight = milestone.tasks
        .filter(t => t.status === 'DONE')
        .reduce((sum, task) => sum + task.weight, 0);
    return completedTaskWeight;
  };

  const isMemberOnly = localUser && !localUser.roles.some((r: Role) => r.name === 'Admin' || r.name === 'Project Manager');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Milestones</CardTitle>
          <CardDescription>
            {isMemberOnly
                ? "An overview of milestones from projects you are involved in."
                : "A complete overview of all milestones across all active projects."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
            {projects.length > 0 ? (
                <Accordion type="multiple" className="w-full">
                    {projects.map(project => {
                      const totalMilestones = project.milestones.length;
                      const completedMilestones = project.milestones.filter(
                        m => m.tasks.length > 0 && m.tasks.every(t => t.status === 'DONE')
                      ).length;

                      return (
                        <AccordionItem value={project.id} key={project.id}>
                            <AccordionTrigger>
                                <div className="flex justify-between items-center w-full pr-4">
                                    <Link href={`/projects/${project.id}`} className="font-semibold text-base hover:underline text-left flex-1">
                                        {project.name}
                                    </Link>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-4">
                                      <span>{totalMilestones} Milestones</span>
                                      <span className="text-gray-400">&bull;</span>
                                      <span>{completedMilestones} Completed</span>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                            <div className="space-y-4 pl-4 border-l-2 ml-2">
                                {(project.milestones && project.milestones.length > 0) ? (
                                project.milestones.map(milestone => {
                                    const progress = calculateMilestoneProgress(milestone);
                                    return (
                                    <div key={milestone.id} className="p-4 border rounded-md">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-semibold">{milestone.title}</h4>
                                            <div className="flex items-center gap-2 w-1/4">
                                                <Progress value={progress} className="h-2" />
                                                <span className="text-xs font-semibold">{Math.round(progress)}%</span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <Badge variant="outline">
                                                Weight: {milestone.weight}%
                                            </Badge>
                                            <Badge variant="outline">
                                                Due: {format(new Date(milestone.dueDate), 'MMM dd, yyyy')}
                                            </Badge>
                                            {(project.responsibleDepartments || []).map(dept => (
                                                <Badge key={dept.id} variant="secondary">{dept.name}</Badge>
                                            ))}
                                        </div>
                                        <Link href={`/projects/${project.id}/milestones`} className="text-sm text-primary hover:underline mt-2 inline-block">
                                            View Tasks &rarr;
                                        </Link>
                                    </div>
                                    )
                                })
                                ) : (
                                <p className="text-sm text-muted-foreground">No milestones for this project.</p>
                                )}
                            </div>
                            </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                </Accordion>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <p>
                        {isMemberOnly 
                            ? "No milestones found for the projects you are involved in."
                            : "No projects have been created yet."
                        }
                    </p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
