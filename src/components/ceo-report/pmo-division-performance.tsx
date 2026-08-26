
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Project, PmoDivision, ProjectStatus } from '@prisma/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { isPast, max as dateMax, parseISO, isAfter } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isClosedStatus, summarizeSchedule, type ProjectScheduleLike, type StatusLike } from '@/lib/metrics';

/**
 * Only what this table reads.
 *
 * It extends ProjectScheduleLike so the schedule metrics can be computed
 * from it directly, rather than being cast into shape — the cast was hiding
 * the fact that the declared type had no endDate at all.
 */
type ProjectWithRelations = ProjectScheduleLike & {
    id: string;
    name: string;
    pmoDivisionId: string;
    statusId: string;
    status: StatusLike;
};

type PmoDivisionPerformanceProps = {
    projects: ProjectWithRelations[];
    pmoDivisions: PmoDivision[];
    projectStatuses: ProjectStatus[];
};

export function PmoDivisionPerformance({ projects, pmoDivisions, projectStatuses }: PmoDivisionPerformanceProps) {

    const statusMap = useMemo(() => new Map(projectStatuses.map(s => [s.id, s.name])), [projectStatuses]);

    const pmoDivisionPerformance = useMemo(() => {
        return pmoDivisions
            .map(div => {
                const divisionProjects = projects.filter(p => p.pmoDivisionId === div.id);

                // Shared metrics, so this card agrees with the KPI row above it.
                // Its own rule mapped incomplete tasks to the epoch and then took
                // a maximum, which meant a division with unfinished work still
                // showed a 100% completion rate.
                const divSchedule = summarizeSchedule(divisionProjects);

                const divCompletedProjects = divisionProjects.filter(p => isClosedStatus(p.status));
                const divCompletionRate = divSchedule.onTimeRate;
                const divOverdueCount = divSchedule.overdue;

                const projectsByStatus = divisionProjects.reduce((acc, project) => {
                    const statusName = statusMap.get(project.statusId) || 'Unknown';
                    if (!acc[statusName]) {
                        acc[statusName] = [];
                    }
                    acc[statusName].push(project);
                    return acc;
                }, {} as Record<string, ProjectWithRelations[]>);

                return {
                    id: div.id,
                    name: div.name,
                    totalProjects: divisionProjects.length,
                    completionRate: divCompletionRate,
                    overdueCount: divOverdueCount,
                    projectsByStatus
                };
            });
    }, [projects, pmoDivisions, statusMap]);

    const defaultOpenAccordionItems = useMemo(() => {
        return pmoDivisionPerformance.filter(div => div.totalProjects > 0).map(div => div.id);
    }, [pmoDivisionPerformance]);

    return (
        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>EPMO Division Performance</CardTitle>
                <CardDescription>A breakdown of key metrics for each EPMO division.</CardDescription>
            </CardHeader>
            <CardContent>
              <TooltipProvider>
                <div className="border rounded-md">
                    {/* Header Row - visible on medium screens and up */}
                    <div className="hidden md:flex p-4 bg-muted/50 border-b font-semibold text-sm text-muted-foreground">
                        <div className="flex-1">EPMO Division</div>
                        <div className="w-32 text-center">Total Projects</div>
                        <div className="w-32 text-center">Completion Rate</div>
                        <div className="w-32 text-center">Overdue</div>
                    </div>
                    
                    {pmoDivisionPerformance.length > 0 ? (
                        <Accordion type="multiple" defaultValue={defaultOpenAccordionItems} className="w-full">
                            {pmoDivisionPerformance.map(div => (
                                <AccordionItem value={div.id} key={div.id} className="border-b">
                                    <AccordionTrigger className="flex flex-col md:flex-row p-4 hover:bg-muted/30 hover:no-underline text-left">
                                        <div className="flex-1 font-semibold text-base mb-2 md:mb-0">{div.name}</div>
                                        <div className="flex w-full md:w-auto justify-between items-center text-lg font-bold">
                                            <div className="md:w-32 text-center">
                                                <span className="md:hidden text-sm font-medium text-muted-foreground">Total: </span>
                                                {div.totalProjects}
                                            </div>
                                            <div className="md:w-32 text-center">
                                                <span className="md:hidden text-sm font-medium text-muted-foreground">Completion: </span>
                                                {div.completionRate.toFixed(0)}%
                                            </div>
                                            <div className="md:w-32 text-center">
                                                <span className="md:hidden text-sm font-medium text-muted-foreground">Overdue: </span>
                                                {div.overdueCount}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/20 space-y-4">
                                            {Object.keys(div.projectsByStatus).length > 0 ? Object.entries(div.projectsByStatus).map(([status, projectList]) => (
                                                <div key={status}>
                                                    <h4 className="font-semibold text-muted-foreground mb-2">{status} ({projectList.length})</h4>
                                                    <div className="pl-4 border-l-2 space-y-2">
                                                        {projectList.map(p => (
                                                            <Tooltip key={p.id}>
                                                              <TooltipTrigger asChild>
                                                                  <Link href={`/projects/${p.id}`} className="block text-sm text-primary hover:underline truncate">
                                                                      {p.name}
                                                                  </Link>
                                                              </TooltipTrigger>
                                                              <TooltipContent>
                                                                  <p>{p.name}</p>
                                                              </TooltipContent>
                                                            </Tooltip>
                                                        ))}
                                                    </div>
                                                </div>
                                            )) : (
                                                 <p className="text-sm text-center text-muted-foreground py-4">No projects to display for this division.</p>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="text-center p-8 text-muted-foreground">
                            No EPMO divisions found.
                        </div>
                    )}
                </div>
              </TooltipProvider>
            </CardContent>
        </Card>
    );
}

