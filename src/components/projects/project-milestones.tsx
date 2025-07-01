
"use client";

import { useState } from "react";
import Link from 'next/link';
import { ArrowLeft, Pencil, PlusCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Milestone, Task, User, Department } from "@/lib/types";
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
import { addTask, updateMilestone, updateTask } from "@/app/projects/actions";

type ProjectMilestonesProps = {
  initialProject: any;
  users: User[];
  departments: Department[];
}

export function ProjectMilestones({ initialProject, users, departments }: ProjectMilestonesProps) {
  const { toast } = useToast();
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [addingTaskToMilestone, setAddingTaskToMilestone] = useState<Milestone | null>(null);
  const [editingTaskInfo, setEditingTaskInfo] = useState<{ task: Task; milestone: Milestone } | null>(null);

  const handleMilestoneUpdate = async (updatedMilestone: Milestone) => {
    setEditingMilestone(null);
    const { id, tasks, ...dataToUpdate } = updatedMilestone;
    await updateMilestone(id, initialProject.id, dataToUpdate);
    toast({
      title: "Milestone Updated!",
      description: `The milestone "${updatedMilestone.title}" has been successfully updated.`,
    });
  };

  const handleTaskAdd = async (milestoneId: string, newTask: any) => {
    setAddingTaskToMilestone(null);
    await addTask(milestoneId, initialProject.id, newTask);
    toast({
      title: "Task Added!",
      description: `The task "${newTask.title}" has been successfully added.`,
    });
  };

  const handleTaskUpdate = async (milestoneId: string, updatedTask: Task) => {
    setEditingTaskInfo(null);
    const { id, ...dataToUpdate } = updatedTask;
    await updateTask(id, initialProject.id, dataToUpdate);
    toast({
      title: "Task Updated!",
      description: `The task "${updatedTask.title}" has been successfully updated.`,
    });
  };

  const departmentMap = new Map(departments.map(d => [d.id, d]));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href={`/projects/${initialProject.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" />
        Back to Project Overview
      </Link>
      <Card>
          <CardHeader>
              <CardTitle>Milestones for: {initialProject.name}</CardTitle>
              <CardDescription>Here are the major milestones for this project. The Project Manager can add tasks to each milestone.</CardDescription>
          </CardHeader>
          <CardContent>
              <Accordion type="single" collapsible className="w-full" defaultValue={initialProject.milestones[0]?.id}>
                  {initialProject.milestones.map((milestone: any) => {
                      const completedTaskWeight = milestone.tasks
                          .filter((t: any) => t.status === 'done')
                          .reduce((sum: number, task: any) => sum + task.weight, 0);

                      const responsibleDepts = milestone.responsibleDepartmentIds.map((id: string) => departmentMap.get(id)).filter(Boolean);
                      return (
                          <AccordionItem value={milestone.id} key={milestone.id}>
                              <AccordionTrigger>
                                <div className="flex-1 flex flex-col items-start gap-3 text-left pr-4">
                                  <div className="flex w-full items-start justify-between gap-4">
                                      <span className="font-semibold text-base flex-1">{milestone.title}</span>
                                      <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          onClick={(e) => { 
                                              e.stopPropagation(); 
                                              setEditingMilestone(milestone) 
                                          }}
                                          className="h-8 w-8 shrink-0"
                                      >
                                          <Pencil className="w-4 h-4" />
                                          <span className="sr-only">Edit Milestone</span>
                                      </Button>
                                  </div>
                                  
                                  <div className="w-full space-y-1">
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                          <span>Milestone Progress</span>
                                          <span className="font-semibold">{completedTaskWeight}%</span>
                                      </div>
                                      <Progress value={completedTaskWeight} className="h-2" />
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="outline">
                                          Weight: {milestone.weight}%
                                      </Badge>
                                      <Badge variant="outline">
                                          Due: {format(parseISO(milestone.dueDate), 'MMM dd, yyyy')}
                                      </Badge>
                                      {responsibleDepts.map(dept => (
                                          <Badge key={dept!.id} variant="secondary">{dept!.name}</Badge>
                                      ))}
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-4">
                                  <p className="text-muted-foreground">{milestone.description}</p>
                                  
                                  <div className="flex justify-between items-center pt-2">
                                      <h4 className="font-semibold">Tasks</h4>
                                      <Button onClick={() => setAddingTaskToMilestone(milestone)}>
                                          <PlusCircle className="mr-2 h-4 w-4" /> Add Task
                                      </Button>
                                  </div>
                                  <TaskList 
                                      tasks={milestone.tasks} 
                                      users={users}
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
            projectMilestones={initialProject.milestones}
            onMilestoneUpdate={handleMilestoneUpdate}
            departments={departments}
        />
      )}

      {addingTaskToMilestone && (
        <AddTaskDialog
            isOpen={!!addingTaskToMilestone}
            onOpenChange={(open) => !open && setAddingTaskToMilestone(null)}
            milestone={addingTaskToMilestone}
            onTaskAdd={handleTaskAdd}
            users={users}
        />
      )}
      
      {editingTaskInfo && (
        <EditTaskDialog
            isOpen={!!editingTaskInfo}
            onOpenChange={(open) => !open && setEditingTaskInfo(null)}
            milestone={editingTaskInfo.milestone}
            task={editingTaskInfo.task}
            onTaskUpdate={handleTaskUpdate}
            users={users}
        />
      )}
    </div>
  );
}
