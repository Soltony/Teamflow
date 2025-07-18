
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPast, parseISO, max as dateMax } from 'date-fns';
import type { Project } from '@prisma/client';
import { Suspense } from 'react';
import prisma from '@/lib/db';

async function ReportsContent({ searchParams }: { searchParams: { type?: string, year?: string } }) {
    const { type, year } = searchParams;

    let title = "Projects Report";
    let description = "A list of projects based on the selected filter.";
    
    const projectStatuses = await prisma.projectStatus.findMany();

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
    
    let [allProjects, allProjectStatuses] = await Promise.all([allProjectsQuery, projectStatuses]);

    let filteredProjects: any[] = [];
    const completedStatusId = allProjectStatuses.find(s => s.name === 'Completed')?.id;
    
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
                    if (allTaskEndDates.length === 0) return false; // Or true based on requirements
                    const lastTaskDate = dateMax(allTaskEndDates);
                    return lastTaskDate > project.endDate;
                });
                break;
            case 'overdue':
                title = "Overdue Projects";
                description = "Active projects that are past their deadline.";
                filteredProjects = allProjects.filter(p => p.statusId !== completedStatusId && isPast(p.endDate));
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
                    {filteredProjects.length > 0 ? (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProjects.map((project) => (
                                <ProjectCard 
                                    key={project.id} 
                                    project={project}
                                    href={type === 'active-blockers' ? `/projects/${project.id}?tab=blockers` : undefined}
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

export default function ReportsPage({ searchParams }: { searchParams: { type?: string, year?: string }}) {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ReportsContent searchParams={searchParams} />
        </Suspense>
    );
}
