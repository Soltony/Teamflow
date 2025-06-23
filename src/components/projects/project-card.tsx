import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/types';
import { format, differenceInDays } from 'date-fns';

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  const completedTasks = project.tasks.filter(task => task.status === 'done').length;
  const progress = project.tasks.length > 0 ? (completedTasks / project.tasks.length) * 100 : 0;
  
  const totalWeight = project.tasks.reduce((sum, task) => sum + task.weight, 0);
  const completedWeight = project.tasks
    .filter(task => task.status === 'done')
    .reduce((sum, task) => sum + task.weight, 0);
  const weightedProgress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;

  const daysRemaining = differenceInDays(new Date(project.endDate), new Date());
  
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
            <span>{completedTasks} / {project.tasks.length}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <Badge variant={daysRemaining < 0 ? 'destructive' : 'secondary'}>
          {daysRemaining < 0 
            ? `Overdue by ${Math.abs(daysRemaining)} days` 
            : `${daysRemaining} days remaining`}
        </Badge>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/projects/${project.id}`}>View Project</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
