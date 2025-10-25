
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from 'next/link';
import { ArrowLeft, Pencil, PlusCircle, Building, Trash2 } from "lucide-react";
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
import { addTask, addMilestone, updateMilestone, updateTask, deleteTask } from "@/app/projects/actions";
import { useAuth } from "@/context/auth-context";
import { AddMilestoneDialog } from "./add-milestone-dialog";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";

type UserWithRoles = User & { roles: { name: string }[] };

type ProjectMilestonesProps = {
  initialProject: any;
  users: UserWithRoles[];
  departments: Department[];
  fetchData: () => Promise<void>;
}

export function ProjectMilestones({ initialProject, users, departments, fetchData: propFetchData }: ProjectMilestonesProps) {
  const { toast } = useToast();
  const { localUser, hasPermission } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState(initialProject);

  const fetchData = useCallback(async () => {
    await propFetchData();
    router.refresh();
  }, [propFetchData, router]);

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  const isCurrentUserProjectManager = localUser?.id === project.projectManagerId;
  const canGloballyUpdateProject = hasPermission('projects:update');
  
  const canManageProjectTasks = canGloballyUpdateProject || isCurrentUserProjectManager;
  const canEditMilestones = canGloballyUpdateProject;

  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [addingTaskToMilestone, setAddingTaskToMilestone] = useState<Milestone | null>(null);
  const [editingTaskInfo, setEditingTaskInfo] = useState<{ task: Task; milestone: Milestone } | null>(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const projectUsers = useMemo(() => {
    if (!project?.departmentId) {
        return users;
    }
    return users.filter(user => user.departmentId === project.departmentId);
  }, [project, users]);

  const handleMilestoneAdd = async (newMilestone: Omit<Milestone, 'id' | 'tasks'>) => {
    await addMilestone(project.id, newMilestone);
    toast({
      title: "Milestone Added!",
      description: `The milestone "${newMilestone.title}" has been successfully added.`,
    });
    setIsAddingMilestone(false);
    await fetchData();
  };

  const handleMilestoneUpdate = async (updatedMilestone: Milestone) => {
    const { id, tasks, ...dataToUpdate } = updatedMilestone;
    await updateMilestone(id, project.id, dataToUpdate);
    toast({
      title: "Milestone Updated!",
      description: `The milestone "${updatedMilestone.title}" has been successfully updated.`,
    });
    setEditingMilestone(null);
    await fetchData();
  };

  const handleTaskAdd = async (projectId: string, milestoneId: string | null, newTask: any) => {
    await addTask(projectId, milestoneId, newTask);
    toast({
      title: "Task Added!",
      description: `The task "${newTask.title}" has been successfully added.`,
    });
    setAddingTaskToMilestone(null);
    await fetchData();
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    const { id, ...dataToUpdate } = updatedTask;
    await updateTask(id, project.id, dataToUpdate);
    toast({
      title: "Task Updated!",
      description: `The task "${updatedTask.title}" has been successfully updated.`,
    });
    setEditingTaskInfo(null);
    await fetchData();
  };

  const handleTaskDeleteConfirm = async () => {
    if (!taskToDelete) return;

    const result = await deleteTask(taskToDelete.id, project.id);
    if (result.success) {
      toast({
        title: "Task Deleted!",
        description: `The task "${taskToDelete.title}" has been removed.`,
      });
      await fetchData();
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to delete the task.",
        variant: "destructive",
      });
    }
    setTaskToDelete(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" />
        Back to Project Overview
      </Link>
      <Card>
          <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Milestones for: {project.name}</CardTitle>
                  <CardDescription>Here are the major milestones for this project. The Project Manager can add tasks to each milestone.</CardDescription>
                </div>
                {canEditMilestones && (
                  <Button onClick={() => setIsAddingMilestone(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Milestone
                  </Button>
                )}
              </div>
          </CardHeader>
          <CardContent>
              <Accordion type="single" collapsible className="w-full" defaultValue={project.milestones[0]?.id}>
                  {project.milestones.map((milestone: any) => {
                      const completedTaskWeight = milestone.tasks
                          .filter((t: any) => t.status === 'DONE')
                          .reduce((sum: number, task: any) => sum + task.weight, 0);

                      return (
                          <AccordionItem value={milestone.id} key={milestone.id}>
                              <AccordionTrigger>
                                <div className="flex-1 flex flex-col items-start gap-3 text-left pr-4">
                                  <div className="flex w-full items-start justify-between gap-4">
                                      <span className="font-semibold text-base flex-1">{milestone.title}</span>
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
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-4">
                                  <p className="text-muted-foreground">{milestone.description}</p>
                                  
                                  <div className="flex justify-between items-center pt-2">
                                      <h4 className="font-semibold">Tasks</h4>
                                      <div className="flex items-center gap-2">
                                        {canEditMilestones && (
                                            <Button variant="outline" size="sm" onClick={() => setEditingMilestone(milestone)}>
                                                <Pencil className="mr-2 h-4 w-4" /> Edit Milestone
                                            </Button>
                                        )}
                                        {canManageProjectTasks && (
                                            <Button size="sm" onClick={() => setAddingTaskToMilestone(milestone)}>
                                                <PlusCircle className="mr-2 h-4 w-4" /> Add Task
                                            </Button>
                                        )}
                                      </div>
                                  </div>
                                  <TaskList 
                                      tasks={milestone.tasks} 
                                      users={projectUsers}
                                      onEditTask={(task) => {
                                          console.log('ProjectMilestones - task data from TaskList:', task);
                                          console.log('ProjectMilestones - task.assignedUserIds:', task.assignedUserIds);
                                          setEditingTaskInfo({ task, milestone });
                                      }}
                                      onDeleteTask={(task) => setTaskToDelete(task)}
                                      canManageTasks={canManageProjectTasks}
                                  />
                              </AccordionContent>
                          </AccordionItem>
                      )
                  })}
              </Accordion>
          </CardContent>
      </Card>
      
      {isAddingMilestone && canEditMilestones && (
        <AddMilestoneDialog
          isOpen={isAddingMilestone}
          onOpenChange={setIsAddingMilestone}
          projectStartDate={project.startDate}
          projectEndDate={project.endDate}
          projectMilestones={project.milestones}
          onMilestoneAdd={handleMilestoneAdd}
        />
      )}

      {editingMilestone && canEditMilestones && (
        <EditMilestoneDialog 
            isOpen={!!editingMilestone}
            onOpenChange={(open) => !open && setEditingMilestone(null)}
            milestone={editingMilestone}
            projectMilestones={project.milestones}
            onMilestoneUpdate={handleMilestoneUpdate}
        />
      )}

      {addingTaskToMilestone && canManageProjectTasks && (
        <AddTaskDialog
            isOpen={!!addingTaskToMilestone}
            onOpenChange={(open) => !open && setAddingTaskToMilestone(null)}
            project={project}
            onTaskAdd={(projectId, milestoneId, newTask) => handleTaskAdd(projectId, addingTaskToMilestone.id, newTask)}
            users={users}
        />
      )}
      
      {editingTaskInfo && canManageProjectTasks && (
        <EditTaskDialog
            isOpen={!!editingTaskInfo}
            onOpenChange={(open) => !open && setEditingTaskInfo(null)}
            project={project}
            task={editingTaskInfo.task}
            onTaskUpdate={handleTaskUpdate}
            users={users}
        />
      )}

      {taskToDelete && (
        <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the task: <span className="font-semibold">"{taskToDelete.title}"</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleTaskDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Task
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
