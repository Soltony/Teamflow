import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/types';
import { projectStatuses } from '@/lib/data';

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  const allTasks = project.milestones.flatMap(m => m.tasks);
  const completedTasks = allTasks.filter(task => task.status === 'done').length;

  const totalWeight = allTasks.reduce((sum, task) => sum + task.weight, 0);
  const completedWeight = allTasks
    .filter(task => task.status === 'done')
    .reduce((sum, task) => sum + task.weight, 0);
  const weightedProgress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
  
  const status = projectStatuses.find(s => s.id === project.statusId);
  
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="hover:text-primary transition-colors">
          <Link href={`/projects/${project.id}`}>{project.name}</Link>
        </CardTitle>
        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(weightedProgress)}%</span>
          </div>
          <Progress value={weightedProgress} className="h-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Tasks</span>
            <span>{completedTasks} / {allTasks.length}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        {status ? (
          <Badge variant='outline'>{status.name}</Badge>
        ) : <div />}
        <Button asChild variant="ghost" size="sm">
          <Link href={`/projects/${project.id}`}>View Project</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
