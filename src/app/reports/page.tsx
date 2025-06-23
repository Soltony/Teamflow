"use client";

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { projects, projectStatuses } from "@/lib/data";
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPast, parseISO, max as dateMax } from 'date-fns';
import type { Project } from '@/lib/types';
import { Suspense } from 'react';

function ReportsContent() {
    const searchParams = useSearchParams();
    const type = searchParams.get('type');

    let title = "Projects Report";
    let description = "A list of projects based on the selected filter.";
    let filteredProjects: Project[] = [];

    const completedStatusId = projectStatuses.find(s => s.name === 'Completed')?.id;
    
    if (type) {
        const allCompletedProjects = projects.filter(p => p.statusId === completedStatusId);
        
        switch (type) {
            case 'on-time':
                title = "On-Time Completion Projects";
                description = "Projects that were completed on or before their scheduled end date.";
                filteredProjects = allCompletedProjects.filter(project => {
                    const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => parseISO(t.endDate)));
                    if (allTaskEndDates.length === 0) return true;
                    const lastTaskDate = dateMax(allTaskEndDates);
                    return lastTaskDate <= parseISO(project.endDate);
                });
                break;
            case 'late':
                title = "Late Completion Projects";
                description = "Projects that were completed after their scheduled end date.";
                const onTimeProjectIds = allCompletedProjects.filter(project => {
                    const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => parseISO(t.endDate)));
                    if (allTaskEndDates.length === 0) return true;
                    const lastTaskDate = dateMax(allTaskEndDates);
                    return lastTaskDate <= parseISO(project.endDate);
                }).map(p => p.id);
                filteredProjects = allCompletedProjects.filter(p => !onTimeProjectIds.includes(p.id));
                break;
            case 'overdue':
                title = "Overdue Projects";
                description = "Active projects that are past their deadline.";
                filteredProjects = projects.filter(p => p.statusId !== completedStatusId && isPast(parseISO(p.endDate)));
                break;
            case 'active-blockers':
                title = "Projects with Active Blockers";
                description = "Projects that have open issues requiring attention.";
                filteredProjects = projects.filter(p => p.blockers?.some(b => b.status === 'open'));
                break;
            default:
                title = "All Projects";
                description = "A list of all projects.";
                filteredProjects = projects;
        }
    } else {
        title = "All Projects";
        description = "A list of all projects.";
        filteredProjects = projects;
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
                                <ProjectCard key={project.id} project={project} />
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

export default function ReportsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ReportsContent />
        </Suspense>
    );
}
