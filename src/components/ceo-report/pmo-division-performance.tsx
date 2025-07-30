
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Project, PmoDivision, ProjectStatus } from '@prisma/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { isPast, max as dateMax, parseISO } from 'date-fns';

type ProjectWithRelations = Project & {
    status: ProjectStatus;
    milestones: { tasks: { endDate: string }[] }[];
};

type PmoDivisionPerformanceProps = {
    projects: ProjectWithRelations[];
    pmoDivisions: PmoDivision[];
    projectStatuses: ProjectStatus[];
};

export function PmoDivisionPerformance({ projects, pmoDivisions, projectStatuses }: PmoDivisionPerformanceProps) {

    const statusMap = useMemo(() => new Map(projectStatuses.map(s => [s.id, s.name])), [projectStatuses]);
    const completedStatusId = useMemo(() => projectStatuses.find(s => s.name === 'Completed')?.id, [projectStatuses]);

    const pmoDivisionPerformance = useMemo(() => {
        return pmoDivisions.map(div => {
            const divisionProjects = projects.filter(p => p.pmoDivisionId === div.id);
            const divCompletedProjects = divisionProjects.filter(p => p.statusId === completedStatusId);
            
            const divOnTimeCount = divCompletedProjects.filter(project => {
                const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => parseISO(t.endDate)));
                if (allTaskEndDates.length === 0) return true;
                const lastTaskDate = dateMax(allTaskEndDates);
                return lastTaskDate <= parseISO(project.endDate as unknown as string);
            }).length;

            const divCompletionRate = divCompletedProjects.length > 0 ? (divOnTimeCount / divCompletedProjects.length) * 100 : 0;
            const divOverdueCount = divisionProjects.filter(p => p.statusId !== completedStatusId && isPast(parseISO(p.endDate as unknown as string))).length;
            
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
    }, [projects, pmoDivisions, statusMap, completedStatusId]);

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
                <div className="border rounded-md">
                    {/* Header Row */}
                    <div className="flex p-4 bg-muted/50 border-b font-semibold text-sm text-muted-foreground">
                        <div className="flex-1">EPMO Division</div>
                        <div className="w-32 text-center">Total Projects</div>
                        <div className="w-32 text-center">Completion Rate</div>
                        <div className="w-32 text-center">Overdue</div>
                    </div>
                    
                    {pmoDivisionPerformance.length > 0 ? (
                        <Accordion type="multiple" defaultValue={defaultOpenAccordionItems} className="w-full">
                            {pmoDivisionPerformance.map(div => (
                                <AccordionItem value={div.id} key={div.id} className="border-b">
                                    <AccordionTrigger className="flex p-4 hover:bg-muted/30 hover:no-underline">
                                        <div className="flex-1 text-left font-semibold text-base">{div.name}</div>
                                        <div className="w-32 text-center text-lg font-bold">{div.totalProjects}</div>
                                        <div className="w-32 text-center text-lg font-bold">{div.completionRate.toFixed(0)}%</div>
                                        <div className="w-32 text-center text-lg font-bold">{div.overdueCount}</div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/20 space-y-4">
                                            {Object.keys(div.projectsByStatus).length > 0 ? Object.entries(div.projectsByStatus).map(([status, projectList]) => (
                                                <div key={status}>
                                                    <h4 className="font-semibold text-muted-foreground mb-2">{status} ({projectList.length})</h4>
                                                    <div className="pl-4 border-l-2 space-y-2">
                                                        {projectList.map(p => (
                                                            <Link href={`/reports?type=${status.toLowerCase()}`} key={p.id} className="block text-sm text-primary hover:underline">
                                                                {p.name}
                                                            </Link>
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
            </CardContent>
        </Card>
    );
}
