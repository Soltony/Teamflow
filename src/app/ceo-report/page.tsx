
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import prisma from "@/lib/db";
import { isPast, max as dateMax, parseISO, isAfter } from 'date-fns';
import { ProjectStatusChart } from "@/components/dashboard/project-status-chart";
import Link from 'next/link';
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { PmoDivisionPerformance } from "@/components/ceo-report/pmo-division-performance";
import { MetricInfo } from "@/components/metrics/metric-info";

import { requirePermissionOrRedirect } from "@/lib/auth/guard";
import { isClosedStatus, isOverdue, statusCategory, summarizeSchedule } from "@/lib/metrics";
import { serialize } from '@/lib/serialize';
import { OPEN_BLOCKER_STATUSES } from '@/lib/validation/blocker';

export const dynamic = 'force-dynamic';

const LinkWrapper = ({ href, count, children }: { href: string; count: number; children: React.ReactNode }) => {
    if (count > 0) {
        return <Link href={href} className="cursor-pointer">{children}</Link>;
    }
    return <>{children}</>;
};

export default async function CEOReportPage() {
    // The route layout gates this too; checking here as well means the page
    // cannot leak the portfolio if it is ever rendered from somewhere else.
    await requirePermissionOrRedirect('reports:view');

    const [projects, projectStatuses, pmoDivisions] = await Promise.all([
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
                    where: { status: { in: [...OPEN_BLOCKER_STATUSES] } }
                },
            },
        }),
        prisma.projectStatus.findMany(),
        prisma.pmoDivision.findMany(),
    ]);

    // Every KPI here comes from @/lib/metrics. This page previously carried its
    // own on-time rule that substituted `new Date(0)` for tasks that were never
    // completed — taken as a maximum, that made outstanding work invisible, so
    // projects with unfinished tasks scored as delivered on time.
    const schedule = summarizeSchedule(projects);

    const totalActiveProjects = projects.filter(p => statusCategory(p.status) === 'ACTIVE').length;
    const totalOpenBlockers = projects.reduce((acc, p) => acc + p.blockers.length, 0);

    const overdueProjects = projects.filter(p => isOverdue(p));
    const totalOverdueProjects = schedule.overdue;

    const completedProjects = projects.filter(p => isClosedStatus(p.status));
    const onTimeProjectsCount = schedule.onTime;
    const overallCompletionRate = schedule.onTimeRate;

    // At-Risk Projects
    const atRiskProjects = projects.filter(p =>
        statusCategory(p.status) === 'ACTIVE' && (isOverdue(p) || p.blockers.length > 0)
    ).sort((a,b) => b.blockers.length - a.blockers.length || a.endDate.getTime() - b.endDate.getTime());

    const serializableProjects = serialize(projects);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl">Portfolio Overview</CardTitle>
                    <CardDescription>A high-level summary of the entire project portfolio's health and performance.</CardDescription>
                </CardHeader>
            </Card>

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <LinkWrapper href="/projects" count={totalActiveProjects}>
                    <Card className="hover:bg-muted/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalActiveProjects}</div>
                            <p className="text-xs text-muted-foreground">Projects currently in progress</p>
                        </CardContent>
                    </Card>
                </LinkWrapper>
                <LinkWrapper href="/reports?type=on-time" count={onTimeProjectsCount}>
                    <Card className="hover:bg-muted/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-1.5">On-Time Completion Rate<MetricInfo metric="onTimeRate" /></CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                 {completedProjects.length > 0 ? `${Math.round(overallCompletionRate)}%` : 'N/A'}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {completedProjects.length > 0 ? 'Of all completed projects' : 'No projects completed yet'}
                            </p>
                        </CardContent>
                    </Card>
                </LinkWrapper>
                <LinkWrapper href="/reports?type=overdue" count={totalOverdueProjects}>
                    <Card className="hover:bg-muted/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-1.5">Overdue Projects<MetricInfo metric="overdue" /></CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalOverdueProjects}</div>
                            <p className="text-xs text-muted-foreground">Active projects past their deadline</p>
                        </CardContent>
                    </Card>
                </LinkWrapper>
                <LinkWrapper href="/reports?type=active-blockers" count={totalOpenBlockers}>
                    <Card className="hover:bg-muted/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-1.5">Open Blockers<MetricInfo metric="blockers" /></CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalOpenBlockers}</div>
                            <p className="text-xs text-muted-foreground">Issues impeding project progress</p>
                        </CardContent>
                    </Card>
                </LinkWrapper>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                 {/* Portfolio Health Chart */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Portfolio Health</CardTitle>
                        <CardDescription>Distribution of projects by status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ProjectStatusChart projects={serializableProjects} projectStatuses={projectStatuses} />
                    </CardContent>
                </Card>

                {/* PMO Division Performance */}
                <PmoDivisionPerformance 
                    projects={serializableProjects}
                    pmoDivisions={pmoDivisions}
                    projectStatuses={projectStatuses}
                />
            </div>

            {/* At-Risk Projects */}
            <Card>
                <CardHeader>
                    <CardTitle>At-Risk Projects</CardTitle>
                    <CardDescription>Projects that are overdue or have open blockers requiring attention.</CardDescription>
                </CardHeader>
                <CardContent>
                    {atRiskProjects.length > 0 ? (
                        <Table scrollLabel="Projects at risk">
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
