
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ProjectCard({ project, href }: { project: any, href?: string }) {
  const allTasks = project.milestones.flatMap((m: any) => m.tasks);
  const completedTasks = allTasks.filter((task: any) => task.status === 'DONE').length;
  const status = project.status;

  const calculateProgress = () => {
    if (status?.name === 'Completed') {
        return 100;
    }
    
    if (!project.milestones || project.milestones.length === 0) {
        return 0;
    }

    const weightedProgress = project.milestones.reduce((progress: number, milestone: any) => {
        const completedTaskWeightInMilestone = milestone.tasks
        .filter((task: any) => task.status === 'DONE')
        .reduce((sum: number, task: any) => sum + task.weight, 0);
        
        const milestoneProgress = completedTaskWeightInMilestone / 100;

        return progress + (milestoneProgress * milestone.weight);
    }, 0);

    return weightedProgress;
  };

  const progress = calculateProgress();
  const projectLink = href || `/projects/${project.id}`;
  
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="hover:text-primary transition-colors">
          <Link href={projectLink}>{project.name}</Link>
        </CardTitle>
        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
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
          <Link href={projectLink}>View Project</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
