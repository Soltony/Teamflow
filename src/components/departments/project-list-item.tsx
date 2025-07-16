"use client";

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function ProjectListItem({ project }: { project: any }) {
    const allTasks = project.milestones.flatMap((m: any) => m.tasks);
    const completedTasks = allTasks.filter((task: any) => task.status === 'DONE').length;

    const weightedProgress = project.milestones.reduce((progress: number, milestone: any) => {
        const completedTaskWeightInMilestone = milestone.tasks
        .filter((task: any) => task.status === 'DONE')
        .reduce((sum: number, task: any) => sum + task.weight, 0);
        
        const milestoneProgress = completedTaskWeightInMilestone / 100;
        return progress + (milestoneProgress * milestone.weight);
    }, 0);

    return (
        <Link href={`/projects/${project.id}`} className="block">
            <Card className="hover:border-primary transition-colors h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <CardDescription className="text-xs">Executed by: {project.owningDepartment?.name || 'N/A'}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                     <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Progress</span>
                        <span>{Math.round(weightedProgress)}%</span>
                    </div>
                    <Progress value={weightedProgress} className="h-2" />
                    <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                        <span>Status: <Badge variant="outline" className="ml-1">{project.status.name}</Badge></span>
                        <span>Milestones: {project.milestones.length}</span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}