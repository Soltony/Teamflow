
'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { ProjectListItem } from "@/components/projects/project-card";
import { CreateProjectButton } from "@/components/projects/create-project-button";
import { getProjectsPageData, addTask, updateTask, deleteTask, addMilestone } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import type { Task as TaskType, User, Project, Milestone } from "@/lib/types";
import { AddTaskDialog } from "@/components/projects/add-task-dialog";
import { EditTaskDialog } from "@/components/projects/edit-task-dialog";
import { useToast } from "@/hooks/use-toast";


function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-36" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
            </div>
        </div>
    )
}

export default function ProjectsPage() {
    const { localUser, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [projects, setProjects] = useState<any[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // State for modals
    const [addingTaskToMilestone, setAddingTaskToMilestone] = useState<Milestone | null>(null);
    const [editingTaskInfo, setEditingTaskInfo] = useState<{ task: TaskType; milestone: Milestone } | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<TaskType | null>(null);

    const fetchData = useCallback(async () => {
        if (localUser?.id) {
            setIsLoading(true);
            try {
                const data = await getProjectsPageData(localUser.id);
                setProjects(data.projects);
                setStatuses(data.statuses);
                setUsers(data.users || []);
            } catch (error) => {
                console.error("Failed to fetch projects", error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [localUser?.id]);

    useEffect(() => {
        if (localUser?.id) {
            fetchData();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [localUser, authLoading, fetchData]);

    const filteredProjects = useMemo(() => {
        let filtered = projects;
        if (searchQuery) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return filtered;
    }, [projects, searchQuery]);

    const handleTaskAdd = async (milestoneId: string, newTask: any) => {
        const projectForTask = projects.find(p => p.milestones.some((m: Milestone) => m.id === milestoneId));
        if (!projectForTask) {
            toast({ title: "Error", description: "Could not find the parent project for this task.", variant: "destructive" });
            return;
        }

        await addTask(milestoneId, projectForTask.id, newTask);
        toast({ title: "Task Added!", description: `The task "${newTask.title}" has been added.` });
        setAddingTaskToMilestone(null);
        await fetchData();
    };

    const handleTaskUpdate = async (milestoneId: string, updatedTask: TaskType) => {
        const { id, ...dataToUpdate } = updatedTask;
        if (!editingTaskInfo) return;
        const project = projects.find(p => p.milestones.some((m: Milestone) => m.id === milestoneId));

        await updateTask(id, project.id, dataToUpdate);
        toast({ title: "Task Updated!", description: "The task has been successfully updated." });
        setEditingTaskInfo(null);
        await fetchData();
    };

    const handleTaskDelete = async () => {
        if (!taskToDelete) return;
        
        const projectForTask = projects.find(p => p.milestones.some((m: Milestone) => m.tasks.some((t: TaskType) => t.id === taskToDelete.id)));

        const result = await deleteTask(taskToDelete.id, projectForTask?.id || '');
        if (result.success) {
            toast({ title: "Task Deleted!", description: `The task "${taskToDelete.title}" has been removed.` });
            await fetchData();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
        setTaskToDelete(null);
    };

    if (isLoading || authLoading) {
        return <LoadingSkeleton />;
    }

    if (!localUser) {
        return (
            <div className="p-4 sm:p-6"><p>Could not load projects. Please try logging in again.</p></div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Projects</h1>
                    <p className="text-muted-foreground">An overview of all active projects and their tasks.</p>
                </div>
                 <div className="flex flex-col-reverse sm:flex-row items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search projects..."
                            className="w-full rounded-lg bg-background pl-8 sm:w-[200px] lg:w-[300px]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <CreateProjectButton />
                </div>
            </div>
            
            {filteredProjects.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                    {filteredProjects.map((project: any) => (
                        <ProjectListItem 
                            key={project.id} 
                            project={project}
                            users={users}
                            onAddTask={setAddingTaskToMilestone}
                            onEditTask={(task, milestone) => setEditingTaskInfo({task, milestone})}
                            onDeleteTask={setTaskToDelete}
                            taskToDelete={taskToDelete}
                            setTaskToDelete={setTaskToDelete}
                            handleDeleteTask={handleTaskDelete}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground font-semibold">No projects found.</p>
                    <p className="text-muted-foreground text-sm">Get started by creating a new project.</p>
                </div>
            )}
            
            {addingTaskToMilestone && (
                <AddTaskDialog
                    isOpen={!!addingTaskToMilestone}
                    onOpenChange={(open) => !open && setAddingTaskToMilestone(null)}
                    milestone={addingTaskToMilestone}
                    users={users}
                    onTaskAdd={handleTaskAdd}
                />
            )}

            {editingTaskInfo && (
                <EditTaskDialog
                    isOpen={!!editingTaskInfo}
                    onOpenChange={(open) => !open && setEditingTaskInfo(null)}
                    milestone={editingTaskInfo.milestone}
                    task={editingTaskInfo.task}
                    users={users}
                    onTaskUpdate={handleTaskUpdate}
                />
            )}
        </div>
    );
}
