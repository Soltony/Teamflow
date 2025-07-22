
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isPast, max as dateMax, parseISO } from 'date-fns';
import type { Project, PmoDivision, ProjectStatus } from '@prisma/client';

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
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const completedStatusId = useMemo(() => projectStatuses.find(s => s.name === 'Completed')?.id, [projectStatuses]);

    const pmoDivisionPerformance = useMemo(() => {
        const filteredProjects = selectedStatus === 'all' 
            ? projects 
            : projects.filter(p => p.statusId === selectedStatus);

        return pmoDivisions.map(div => {
            const divisionProjects = filteredProjects.filter(p => p.pmoDivisionId === div.id);
            const divCompletedProjects = divisionProjects.filter(p => p.statusId === completedStatusId);

            const divOnTimeCount = divCompletedProjects.filter(project => {
                const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => parseISO(t.endDate)));
                if (allTaskEndDates.length === 0) return true;
                const lastTaskDate = dateMax(allTaskEndDates);
                return lastTaskDate <= parseISO(project.endDate as unknown as string);
            }).length;

            const divCompletionRate = divCompletedProjects.length > 0 ? (divOnTimeCount / divCompletedProjects.length) * 100 : 0;
            const divOverdueCount = divisionProjects.filter(p => p.statusId !== completedStatusId && isPast(parseISO(p.endDate as unknown as string))).length;

            return {
                id: div.id,
                name: div.name,
                totalProjects: divisionProjects.length,
                completionRate: Math.round(divCompletionRate),
                overdueCount: divOverdueCount,
            };
        });
    }, [selectedStatus, projects, pmoDivisions, completedStatusId]);

    const activeStatuses = useMemo(() => {
        const activeStatusIds = new Set(projects.map(p => p.statusId));
        return projectStatuses.filter(s => activeStatusIds.has(s.id));
    }, [projects, projectStatuses]);

    return (
        <Card className="md:col-span-2">
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>PMO Division Performance</CardTitle>
                        <CardDescription>A breakdown of key metrics for each PMO division.</CardDescription>
                    </div>
                    <div className="w-full sm:w-auto sm:max-w-[200px] pt-2 sm:pt-0">
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by status..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {activeStatuses.map(status => (
                                    <SelectItem key={status.id} value={status.id}>
                                        {status.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>PMO Division</TableHead>
                            <TableHead className="text-center">Total Projects</TableHead>
                            <TableHead className="text-center">On-Time Completion</TableHead>
                            <TableHead className="text-center">Overdue</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pmoDivisionPerformance.map(div => (
                            <TableRow key={div.id}>
                                <TableCell className="font-medium">{div.name}</TableCell>
                                <TableCell className="text-center">{div.totalProjects}</TableCell>
                                <TableCell className="text-center">
                                    {div.totalProjects > 0 ? `${div.completionRate}%` : 'N/A'}
                                </TableCell>
                                <TableCell className="text-center">{div.overdueCount}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
