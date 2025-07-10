
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import prisma from "@/lib/db";
import { isPast, max as dateMax } from 'date-fns';
import { ProjectStatusChart } from "@/components/dashboard/project-status-chart";
import Link from 'next/link';
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

export const dynamic = 'force-dynamic';

export default async function CEOReportPage() {
    const [projects, projectStatuses, departments] = await Promise.all([
        prisma.project.findMany({
            include: {
                status: true,
                projectManager: true,
                milestones: {
                    include: {
                        tasks: true,
                    },
                },
                blockers: {
                    where: { status: 'OPEN' }
                },
            },
        }),
        prisma.projectStatus.findMany(),
        prisma.department.findMany(),
    ]);

    const completedStatusId = projectStatuses.find(s => s.name === 'Completed')?.id;

    // KPI Calculations
    const totalActiveProjects = projects.filter(p => p.statusId !== completedStatusId).length;
    const totalOpenBlockers = projects.reduce((acc, p) => acc + p.blockers.length, 0);
    const overdueProjects = projects.filter(p => p.statusId !== completedStatusId && isPast(p.endDate));
    const totalOverdueProjects = overdueProjects.length;

    const completedProjects = projects.filter(p => p.statusId === completedStatusId);
    const onTimeProjectsCount = completedProjects.filter(project => {
        const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => t.endDate));
        if (allTaskEndDates.length === 0) return true;
        const lastTaskDate = dateMax(allTaskEndDates);
        return lastTaskDate <= project.endDate;
    }).length;
    const overallCompletionRate = completedProjects.length > 0 ? (onTimeProjectsCount / completedProjects.length) * 100 : 100;

    // Division Performance Calculation
    const divisionPerformance = departments.map(dept => {
        const divisionProjects = projects.filter(p => p.departmentId === dept.id);
        const divCompletedProjects = divisionProjects.filter(p => p.statusId === completedStatusId);
        const divOnTimeCount = divCompletedProjects.filter(project => {
            const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => t.endDate));
            if (allTaskEndDates.length === 0) return true;
            const lastTaskDate = dateMax(allTaskEndDates);
            return lastTaskDate <= project.endDate;
        }).length;
        const divCompletionRate = divCompletedProjects.length > 0 ? (divOnTimeCount / divCompletedProjects.length) * 100 : 100;
        const divOverdueCount = divisionProjects.filter(p => p.statusId !== completedStatusId && isPast(p.endDate)).length;

        return {
            id: dept.id,
            name: dept.name,
            totalProjects: divisionProjects.length,
            completionRate: Math.round(divCompletionRate),
            overdueCount: divOverdueCount,
        };
    });

    // At-Risk Projects
    const atRiskProjects = projects.filter(p => 
        p.statusId !== completedStatusId && (isPast(p.endDate) || p.blockers.length > 0)
    ).sort((a,b) => b.blockers.length - a.blockers.length || a.endDate.getTime() - b.endDate.getTime());


    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl">Reports: Portfolio Overview</CardTitle>
                    <CardDescription>A high-level summary of the entire project portfolio's health and performance.</CardDescription>
                </CardHeader>
            </Card>

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalActiveProjects}</div>
                        <p className="text-xs text-muted-foreground">Projects currently in progress</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">On-Time Completion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(overallCompletionRate)}%</div>
                        <p className="text-xs text-muted-foreground">Of all completed projects</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOverdueProjects}</div>
                        <p className="text-xs text-muted-foreground">Active projects past their deadline</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Open Blockers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOpenBlockers}</div>
                        <p className="text-xs text-muted-foreground">Issues impeding project progress</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                 {/* Portfolio Health Chart */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Portfolio Health</CardTitle>
                        <CardDescription>Distribution of projects by status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ProjectStatusChart projects={projects} projectStatuses={projectStatuses} />
                    </CardContent>
                </Card>

                {/* Division Performance */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Division Performance</CardTitle>
                        <CardDescription>A breakdown of key metrics for each division.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Division</TableHead>
                                    <TableHead className="text-center">Total Projects</TableHead>
                                    <TableHead className="text-center">Completion Rate</TableHead>
                                    <TableHead className="text-center">Overdue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {divisionPerformance.map(div => (
                                    <TableRow key={div.id}>
                                        <TableCell className="font-medium">{div.name}</TableCell>
                                        <TableCell className="text-center">{div.totalProjects}</TableCell>
                                        <TableCell className="text-center">{div.completionRate}%</TableCell>
                                        <TableCell className="text-center">{div.overdueCount}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* At-Risk Projects */}
            <Card>
                <CardHeader>
                    <CardTitle>At-Risk Projects</CardTitle>
                    <CardDescription>Projects that are overdue or have open blockers requiring attention.</CardDescription>
                </CardHeader>
                <CardContent>
                    {atRiskProjects.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project</TableHead>
                                    <TableHead>Project Manager</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead className="text-center">Reason for Risk</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {atRiskProjects.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">
                                            <Link href={`/projects/${p.id}`} className="hover:underline">{p.name}</Link>
                                        </TableCell>
                                        <TableCell>{p.projectManager?.name ?? 'N/A'}</TableCell>
                                        <TableCell>{format(p.endDate, 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {isPast(p.endDate) && (
                                                    <Badge variant="destructive" className="flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3"/> Overdue
                                                    </Badge>
                                                )}
                                                {p.blockers.length > 0 && (
                                                    <Badge variant="destructive" className="flex items-center gap-1">
                                                        <ShieldAlert className="w-3 h-3"/> {p.blockers.length} Blocker(s)
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No at-risk projects found. Great job!</p>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
