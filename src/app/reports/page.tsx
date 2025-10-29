import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPast, parseISO, max as dateMax } from 'date-fns';
import type { Project } from '@prisma/client';
import { Suspense } from 'react';
import prisma from '@/lib/db';
import { redirect } from 'next/navigation';

async function ReportsContent({ searchParams }: { searchParams: Promise<{ type?: string, year?: string }> }) {
    const resolvedSearchParams = await searchParams;
    const type = resolvedSearchParams?.type;
    const year = resolvedSearchParams?.year;

    let title = "Projects Report";
    let description = "A list of projects based on the selected filter.";

    const allProjectStatuses = await prisma.projectStatus.findMany();

    const allProjectsQuery = prisma.project.findMany({
        where: year && year !== 'all' ? { workingYear: year } : {},
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
    const completedStatusId = allProjectStatuses.find(s => s.name === 'Completed')?.id;
    const nonArchivedStatusNames = ['Active', 'Pending', 'Parked'];

    if (type) {
        const allCompletedProjects = allProjects.filter(p => p.statusId === completedStatusId);
        
        switch (type) {
            case 'on-time':
                title = "On-Time Completion Projects";
                description = "Projects that were completed on or before their scheduled end date.";
                filteredProjects = allCompletedProjects.filter(project => {
                    const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => t.endDate));
                    if (allTaskEndDates.length === 0) return true;
                    const lastTaskDate = dateMax(allTaskEndDates);
                    return lastTaskDate <= project.endDate;
                });
                break;
            case 'late':
                title = "Late Completion Projects";
                description = "Projects that were completed after their scheduled end date.";
                filteredProjects = allCompletedProjects.filter(project => {
                    const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => t.endDate));
                    if (allTaskEndDates.length === 0) return false;
                    const lastTaskDate = dateMax(allTaskEndDates);
                    return lastTaskDate > project.endDate;
                });
                break;
            case 'overdue':
                title = "Overdue Projects";
                description = "Active projects that are past their deadline.";
                filteredProjects = allProjects.filter(p => nonArchivedStatusNames.includes(p.status.name) && isPast(p.endDate));
                break;
            case 'active-blockers':
                title = "Projects with Active Blockers";
                description = "Projects that have open issues requiring attention.";
                filteredProjects = allProjects.filter(p => p.blockers?.some(b => b.status === 'OPEN'));
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

    const serializableProjects = JSON.parse(JSON.stringify(filteredProjects));

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

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string, year?: string }> }) {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ReportsContent searchParams={searchParams} />
        </Suspense>
    );
}
