import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskList } from "@/components/projects/task-list";
import { GanttChart } from "@/components/projects/gantt-chart";
import { differenceInDays, format } from "date-fns";
import { Calendar, Layers, ArrowLeft } from "lucide-react";
import Link from 'next/link';

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const project = projects.find((p) => p.id === params.id);

  if (!project) {
    notFound();
  }

  const totalWeight = project.tasks.reduce((sum, task) => sum + task.weight, 0);
  const completedWeight = project.tasks
    .filter(task => task.status === 'done')
    .reduce((sum, task) => sum + task.weight, 0);
  const weightedProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{project.name}</CardTitle>
          <CardDescription>{project.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(project.startDate), "MMM d, yyyy")} - {format(new Date(project.endDate), "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{project.tasks.length} Tasks</span>
            </div>
             <div className="flex items-center gap-2">
              <span>{differenceInDays(new Date(project.endDate), new Date())} days left</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-medium text-primary">{weightedProgress}%</span>
            </div>
            <Progress value={weightedProgress} className="h-2.5" />
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="tasks">Task List</TabsTrigger>
          <TabsTrigger value="gantt">Gantt Chart</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>Manage and track all tasks for this project.</CardDescription>
            </CardHeader>
            <CardContent>
                <TaskList tasks={project.tasks} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="gantt">
            <Card>
                <CardHeader>
                    <CardTitle>Gantt Chart</CardTitle>
                    <CardDescription>Visualize the project timeline and task dependencies.</CardDescription>
                </CardHeader>
                <CardContent>
                    <GanttChart project={project} />
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
