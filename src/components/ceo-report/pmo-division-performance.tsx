
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Project, PmoDivision, ProjectStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';

type ProjectWithRelations = Project & {
    status: ProjectStatus;
};

type PmoDivisionPerformanceProps = {
    projects: ProjectWithRelations[];
    pmoDivisions: PmoDivision[];
    projectStatuses: ProjectStatus[];
};

export function PmoDivisionPerformance({ projects, pmoDivisions, projectStatuses }: PmoDivisionPerformanceProps) {

    const statusMap = useMemo(() => new Map(projectStatuses.map(s => [s.id, s.name])), [projectStatuses]);

    const pmoDivisionPerformance = useMemo(() => {
        return pmoDivisions.map(div => {
            const divisionProjects = projects.filter(p => p.pmoDivisionId === div.id);
            
            const statusCounts = divisionProjects.reduce((acc, project) => {
                const statusName = statusMap.get(project.statusId) || 'Unknown';
                acc[statusName] = (acc[statusName] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            return {
                id: div.id,
                name: div.name,
                totalProjects: divisionProjects.length,
                statusCounts: statusCounts,
            };
        });
    }, [projects, pmoDivisions, statusMap]);
    
    const allStatusesInUse = useMemo(() => {
        const statusNames = new Set<string>();
        pmoDivisionPerformance.forEach(div => {
            Object.keys(div.statusCounts).forEach(statusName => {
                statusNames.add(statusName);
            });
        });
        return Array.from(statusNames).sort();
    }, [pmoDivisionPerformance]);

    return (
        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>PMO Division Performance</CardTitle>
                <CardDescription>A breakdown of project counts by status for each PMO division.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>PMO Division</TableHead>
                            {allStatusesInUse.map(statusName => (
                                <TableHead key={statusName} className="text-center">{statusName}</TableHead>
                            ))}
                            <TableHead className="text-center font-bold">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pmoDivisionPerformance.length > 0 ? pmoDivisionPerformance.map(div => (
                            <TableRow key={div.id}>
                                <TableCell className="font-medium">{div.name}</TableCell>
                                {allStatusesInUse.map(statusName => (
                                    <TableCell key={statusName} className="text-center">
                                        {div.statusCounts[statusName] || 0}
                                    </TableCell>
                                ))}
                                <TableCell className="text-center font-bold">
                                    <Badge variant="secondary" className="text-base">
                                        {div.totalProjects}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        )) : (
                           <TableRow>
                                <TableCell colSpan={allStatusesInUse.length + 2} className="h-24 text-center">
                                    No projects found to display performance data.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
