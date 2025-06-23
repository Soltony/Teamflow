
"use client";

import { useState } from "react";
import Link from 'next/link';
import { ArrowLeft, Building, Calendar, Layers, UserCircle, Pencil, PlusCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { departments, users, projectStatuses } from "@/lib/data";
import type { Project, Milestone, Task, Blocker } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/projects/task-list";
import { EditMilestoneDialog } from "./edit-milestone-dialog";
import { AddTaskDialog } from "./add-task-dialog";
import { useToast } from "@/hooks/use-toast";
import { EditTaskDialog } from "./edit-task-dialog";
import { AddBlockerDialog } from "./add-blocker-dialog";
import { ResolveBlockerDialog } from "./resolve-blocker-dialog";
import { Separator } from "../ui/separator";

type ProjectViewProps = {
  initialProject: Project;
}

export function ProjectView({ initialProject }: ProjectViewProps) {
  const { toast } = useToast();
  const [project, setProject] = useState<Project>(initialProject);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [addingTaskToMilestone, setAddingTaskToMilestone] = useState<Milestone | null>(null);
  const [editingTaskInfo, setEditingTaskInfo] = useState<{ task: Task; milestone: Milestone } | null>(null);
  const [addingBlocker, setAddingBlocker] = useState(false);
  const [resolvingBlocker, setResolvingBlocker] = useState<Blocker | null>(null);


  const department = departments.find(d => d.id === project.departmentId);
  const projectManager = users.find(u => u.id === project.projectManagerId);
  const status = projectStatuses.find(s => s.id === project.statusId);

  const weightedProgress = project.milestones.reduce((progress, milestone) => {
    const completedTaskWeightInMilestone = milestone.tasks
      .filter(task => task.status === 'done')
      .reduce((sum, task) => sum + task.weight, 0);
    
    // Milestone progress is (completed weight / 100), as task weights are designed to sum to 100
    const milestoneProgress = completedTaskWeightInMilestone / 100;

    // Add this milestone's weighted contribution to the total project progress
    return progress + (milestoneProgress * milestone.weight);
  }, 0);

  const handleMilestoneUpdate = (updatedMilestone: Milestone) => {
    const newMilestones = project.milestones.map(m => 
      m.id === updatedMilestone.id ? updatedMilestone : m
    );

    setProject(prevProject => ({
      ...prevProject,
      milestones: newMilestones,
    }));
  };

  const handleTaskAdd = (milestoneId: string, newTask: Task) => {
    setProject(prevProject => ({
      ...prevProject,
      milestones: prevProject.milestones.map(m =>
        m.id === milestoneId ? { ...m, tasks: [...m.tasks, newTask] } : m
      ),
    }));
  };

  const handleTaskUpdate = (milestoneId: string, updatedTask: Task) => {
    setProject(prevProject => ({
      ...prevProject,
      milestones: prevProject.milestones.map(m =>
        m.id === milestoneId
          ? { ...m, tasks: m.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) }
          : m
      ),
    }));
  };

  const handleBlockerAdd = (data: { description: string }) => {
    const newBlocker: Blocker = {
      id: `blocker-${Date.now()}`,
      description: data.description,
      status: 'open',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setProject(prev => ({
      ...prev,
      blockers: [...(prev.blockers || []), newBlocker],
    }));
    toast({
      title: "Blocker Added",
      description: "The project blocker has been recorded and is now visible to management.",
    });
  };

  const handleBlockerResolve = (blockerId: string, resolution: string) => {
    setProject(prev => ({
      ...prev,
      blockers: (prev.blockers || []).map(b => 
        b.id === blockerId 
          ? { 
              ...b, 
              status: 'resolved', 
              resolution, 
              resolvedAt: new Date().toISOString().split('T')[0] 
            } 
          : b
      ),
    }));
    toast({
      title: "Blocker Resolved",
      description: "The blocker has been marked as resolved.",
    });
  };


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>
      
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-3xl">{project.name}</CardTitle>
            {status && <Badge className="shrink-0 text-base" variant="secondary">{status.name}</Badge>}
          </div>
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
              <span className="text-sm font-medium text-primary">{Math.round(weightedProgress)}%</span>
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
            <Accordion type="single" collapsible className="w-full" defaultValue={project.milestones[0]?.id}>
                {project.milestones.map((milestone) => {
                    const completedTaskWeight = milestone.tasks
                        .filter(t => t.status === 'done')
                        .reduce((sum, task) => sum + task.weight, 0);

                    return (
                        <AccordionItem value={milestone.id} key={milestone.id}>
                            <AccordionTrigger>
                                <div className="flex-1 flex justify-between items-center pr-2">
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-semibold">{milestone.title}</span>
                                        <span className="text-sm text-muted-foreground">
                                            Weight: {milestone.weight}% | Due: {format(new Date(milestone.dueDate), 'MMM dd, yyyy')}
                                        </span>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setEditingMilestone(milestone) 
                                        }}
                                        className="h-8 w-8"
                                    >
                                        <Pencil className="w-4 h-4" />
                                        <span className="sr-only">Edit Milestone</span>
                                    </Button>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <p className="text-muted-foreground">{milestone.description}</p>
                                
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">Milestone Progress</span>
                                      <span className="text-sm font-medium text-primary">{completedTaskWeight}%</span>
                                    </div>
                                    <Progress value={completedTaskWeight} className="h-2" />
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <h4 className="font-semibold">Tasks</h4>
                                    <Button onClick={() => setAddingTaskToMilestone(milestone)}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Task
                                    </Button>
                                </div>
                                <TaskList 
                                    tasks={milestone.tasks} 
                                    onEditTask={(task) => setEditingTaskInfo({ task, milestone })}
                                />
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Project Blockers</CardTitle>
            <Button onClick={() => setAddingBlocker(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Blocker
            </Button>
          </div>
          <CardDescription>
            Issues that are impeding progress and require higher management attention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!project.blockers || project.blockers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No blockers have been reported for this project.</p>
            ) : (
              project.blockers.map((blocker, index) => (
                <div key={blocker.id}>
                  <div className="flex items-start gap-4">
                    <div>
                      {blocker.status === 'open' ? (
                         <ShieldAlert className="h-5 w-5 text-destructive mt-1" />
                      ) : (
                         <ShieldCheck className="h-5 w-5 text-green-600 mt-1" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                         <p className="font-semibold">{blocker.status === 'open' ? 'Open Blocker' : 'Resolved Blocker'}</p>
                         <p className="text-xs text-muted-foreground">
                          {blocker.status === 'open' ? 'Created: ' : 'Resolved: '} 
                          {format(parseISO(blocker.resolvedAt || blocker.createdAt), 'MMM dd, yyyy')}
                         </p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{blocker.description}</p>
                      {blocker.status === 'resolved' && (
                        <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md border">
                            <p className="font-semibold text-xs">Resolution:</p>
                            <p className="text-muted-foreground">{blocker.resolution}</p>
                        </div>
                      )}
                    </div>
                    <div>
                    {blocker.status === 'open' && (
                      <Button variant="outline" size="sm" onClick={() => setResolvingBlocker(blocker)}>
                        Resolve
                      </Button>
                    )}
                    </div>
                  </div>
                  {index < project.blockers.length - 1 && <Separator className="my-4" />}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {editingMilestone && (
        <EditMilestoneDialog 
            isOpen={!!editingMilestone}
            onOpenChange={(open) => !open && setEditingMilestone(null)}
            milestone={editingMilestone}
            projectMilestones={project.milestones}
            onMilestoneUpdate={handleMilestoneUpdate}
        />
      )}

      {addingTaskToMilestone && (
        <AddTaskDialog
            isOpen={!!addingTaskToMilestone}
            onOpenChange={(open) => !open && setAddingTaskToMilestone(null)}
            milestone={addingTaskToMilestone}
            onTaskAdd={handleTaskAdd}
        />
      )}
      
      {editingTaskInfo && (
        <EditTaskDialog
            isOpen={!!editingTaskInfo}
            onOpenChange={(open) => !open && setEditingTaskInfo(null)}
            milestone={editingTaskInfo.milestone}
            task={editingTaskInfo.task}
            onTaskUpdate={handleTaskUpdate}
        />
      )}

      {addingBlocker && (
        <AddBlockerDialog
          isOpen={addingBlocker}
          onOpenChange={setAddingBlocker}
          onBlockerAdd={handleBlockerAdd}
        />
      )}
      
      {resolvingBlocker && (
        <ResolveBlockerDialog
          isOpen={!!resolvingBlocker}
          onOpenChange={(open) => !open && setResolvingBlocker(null)}
          blocker={resolvingBlocker}
          onBlockerResolve={handleBlockerResolve}
        />
      )}
    </div>
  );
}
