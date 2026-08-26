
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPast, parseISO, max as dateMax, endOfDay, isAfter } from 'date-fns';
import type { Project } from '@prisma/client';
import { Suspense } from 'react';
import prisma from '@/lib/db';
import { requirePermissionOrRedirect } from '@/lib/auth/guard';
import { isLate, isOnTime, isOverdue } from '@/lib/metrics';
import { serialize } from '@/lib/serialize';
import { isOpenBlocker } from '@/lib/validation/blocker';

// Reads the session, so it must never be prerendered.
export const dynamic = 'force-dynamic';

type ReportSearchParams = { type?: string; year?: string; division?: string };

async function ReportsContent({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
    // This page previously read every project in the portfolio with no
    // permission check of any kind.
    await requirePermissionOrRedirect('reports:view');

    // Next 15 hands these over as a promise.
    const params = await searchParams;
    const type = params?.type;
    const year = params?.year;
    const division = params?.division;

    let title = "Projects Report";
    let description = "A list of projects based on the selected filter.";

    const allProjectStatuses = await prisma.projectStatus.findMany();

    const allProjectsQuery = prisma.project.findMany({
        // Both filters, because the dashboard cards were counted under both.
        // Honouring only the year is what made a card read 7 and its list 19.
        where: {
            ...(year && year !== 'all' ? { workingYear: year } : {}),
            ...(division ? { pmoDivisionId: division } : {}),
        },
        include: { 
            status: true,
            milestones: {
                include: {
                    tasks: true
                }
            },
            blockers: true
        }
    });

    const [allProjects] = await Promise.all([allProjectsQuery]);

    let filteredProjects: any[] = [];

    if (type) {
        // Same predicates the dashboard and CEO report use, so a drill-down
        // always lists exactly the projects the card counted. These filters
        // previously used planned task dates while the cards used actual
        // completion, so the number and the list disagreed.
        switch (type) {
            case 'on-time':
                title = "On-Time Completion Projects";
                description = "Completed projects delivered on or before their committed deadline.";
                filteredProjects = allProjects.filter(isOnTime);
                break;
            case 'late':
                title = "Late Completion Projects";
                description = "Completed projects delivered after their committed deadline.";
                filteredProjects = allProjects.filter(isLate);
                break;
            case 'overdue':
                title = "Overdue Projects";
                description = "Projects still running that are past their deadline.";
                filteredProjects = allProjects.filter(p => isOverdue(p));
                break;
            case 'active-blockers':
                title = "Projects with Active Blockers";
                description = "Projects that have open issues requiring attention.";
                filteredProjects = allProjects.filter(p => p.blockers?.some(b => isOpenBlocker(b.status)));
                break;
            default:
                title = "All Projects";
                description = "A list of all projects.";
                filteredProjects = allProjects;
        }
    } else {
        title = "All Projects";
        description = "A list of all projects.";
        filteredProjects = allProjects;
    }
    
    const serializableProjects = serialize(filteredProjects);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
            </Link>
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    {serializableProjects.length > 0 ? (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {serializableProjects.map((project: any) => (
                                <ProjectCard 
                                    key={project.id} 
                                    project={project}
                                    href={type === 'active-blockers' ? `/projects/${project.id}?tab=blockers` : `/projects/${project.id}`}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No projects match the current filter.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
    return (
        <Suspense fallback={<div className="p-4 sm:p-6">Loading...</div>}>
            <ReportsContent searchParams={searchParams} />
        </Suspense>
    );
}
