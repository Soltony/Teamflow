import { notFound } from "next/navigation";
import { projects, departments, users } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TaskList } from "@/components/projects/task-list";
import { differenceInDays, format } from "date-fns";
import { Calendar, Layers, ArrowLeft, Building, UserCircle } from "lucide-react";
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const project = projects.find((p) => p.id === params.id);

  if (!project) {
    notFound();
  }

  const department = departments.find(d => d.id === project.departmentId);
  const projectManager = users.find(u => u.id === project.projectManagerId);

  const allTasks = project.milestones.flatMap(m => m.tasks);
  const totalWeight = allTasks.reduce((sum, task) => sum + task.weight, 0);
  const completedWeight = allTasks
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(project.startDate), "MMM d, yyyy")} - {format(new Date(project.endDate), "MMM d, yyyy")}</span>
            </div>
             <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span>{department?.name || 'N/A'}</span>
            </div>
             <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                <span>PM: {projectManager?.name || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{project.milestones.length} Milestones</span>
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
      
      <Card>
        <CardHeader>
            <CardTitle>Project Milestones</CardTitle>
            <CardDescription>Here are the major milestones for this project. The Project Manager can add tasks to each milestone.</CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="w-full">
                {project.milestones.map((milestone) => (
                    <AccordionItem value={milestone.id} key={milestone.id}>
                        <AccordionTrigger>
                            <div className="flex flex-col items-start text-left">
                                <span className="font-semibold">{milestone.title}</span>
                                <span className="text-sm text-muted-foreground">Due: {format(new Date(milestone.dueDate), 'MMM dd, yyyy')}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                            <p className="text-muted-foreground">{milestone.description}</p>
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold">Tasks</h4>
                                <Button disabled>Add Task</Button>
                            </div>
                            <TaskList tasks={milestone.tasks} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
