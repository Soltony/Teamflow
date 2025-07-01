"use client";

import { useState } from "react";
import Link from 'next/link';
import { ArrowLeft, Pencil, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { departments } from "@/lib/data";
import type { Project, Milestone, Task } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/projects/task-list";
import { EditMilestoneDialog } from "./edit-milestone-dialog";
import { AddTaskDialog } from "./add-task-dialog";
import { useToast } from "@/hooks/use-toast";
import { EditTaskDialog } from "./edit-task-dialog";
import { Progress } from "../ui/progress";

type ProjectMilestonesProps = {
  initialProject: Project;
}

export function ProjectMilestones({ initialProject }: ProjectMilestonesProps) {
  const { toast } = useToast();
  const [project, setProject] = useState<Project>(initialProject);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [addingTaskToMilestone, setAddingTaskToMilestone] = useState<Milestone | null>(null);
  const [editingTaskInfo, setEditingTaskInfo] = useState<{ task: Task; milestone: Milestone } | null>(null);

  const handleMilestoneUpdate = (updatedMilestone: Milestone) => {
    const newMilestones = project.milestones.map(m => 
      m.id === updatedMilestone.id ? updatedMilestone : m
    );
    setProject(prevProject => ({ ...prevProject, milestones: newMilestones }));
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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" />
        Back to Project Overview
      </Link>
      <Card>
          <CardHeader>
              <CardTitle>Milestones for: {project.name}</CardTitle>
              <CardDescription>Here are the major milestones for this project. The Project Manager can add tasks to each milestone.</CardDescription>
          </CardHeader>
          <CardContent>
              <Accordion type="single" collapsible className="w-full" defaultValue={project.milestones[0]?.id}>
                  {project.milestones.map((milestone) => {
                      const completedTaskWeight = milestone.tasks
                          .filter(t => t.status === 'done')
                          .reduce((sum, task) => sum + task.weight, 0);

                      const responsibleDepts = departments.filter(d => milestone.responsibleDepartmentIds.includes(d.id));
                      return (
                          <AccordionItem value={milestone.id} key={milestone.id}>
                              <AccordionTrigger>
                                  <div className="flex-1 flex justify-between items-center pr-2">
                                      <div className="flex flex-col items-start text-left gap-2">
                                          <span className="font-semibold">{milestone.title}</span>
                                          <div className="flex flex-wrap items-center gap-2">
                                              <Badge variant="outline">
                                                  Weight: {milestone.weight}%
                                              </Badge>
                                              <Badge variant="outline">
                                                  Due: {format(new Date(milestone.dueDate), 'MMM dd, yyyy')}
                                              </Badge>
                                              {responsibleDepts.map(dept => (
                                                  <Badge key={dept.id} variant="secondary">{dept.name}</Badge>
                                              ))}
                                          </div>
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
    </div>
  );
}
