

'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { anyFilterActive } from "@/lib/ui/empty-state";
import { ProjectListItem } from "@/components/projects/project-card";
import { CreateProjectButton } from "@/components/projects/create-project-button";
import { getProjectsPageData, addTask, updateTask, deleteTask } from "./actions";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import type { Task as TaskType, User, Project, Milestone, ProjectStatus, PmoDivision, Team, UserWithRoles } from "@/lib/types";
import { AddTaskDialog } from "@/components/projects/add-task-dialog";
import { EditTaskDialog } from "@/components/projects/edit-task-dialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamDialog } from "@/components/teams/team-dialog";
import { createTeam, updateTeam, deleteTeam } from "@/app/teams/actions";
import { useFirstLoad } from "@/hooks/use-first-load";


function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading projects">
          <div className="p-4 sm:p-6 space-y-6">
              <div className="flex justify-between items-center mb-6">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-10 w-36" />
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
              </div>
          </div>
        </LoadingRegion>
    )
}

export default function ProjectsPage() {
    const { localUser, loading: authLoading, hasPermission } = useAuth();
    const { toast } = useToast();
    const [projects, setProjects] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<UserWithRoles[]>([]);
    const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
    const [pmoDivisions, setPmoDivisions] = useState<PmoDivision[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    /**
     * Searching now runs in the database, so every keystroke would otherwise be
     * a query. The input stays responsive; the fetch waits for a pause.
     */
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    const [currentPage, setCurrentPage] = useState(1);
    const projectsPerPage = 9;
  
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [selectedPmoDivision, setSelectedPmoDivision] = useState<string | null>(null);

    const [expandedItem, setExpandedItem] = useState<{ projectId: string; section: 'tasks' | 'teams' } | null>(null);

    // State for modals
    const [addingTaskToProject, setAddingTaskToProject] = useState<any | null>(null);
    const [editingTaskInfo, setEditingTaskInfo] = useState<{ task: TaskType; project: Project } | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<TaskType | null>(null);

    // State for team modals
    const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<{ team: Team, project: Project } | null>(null);
    const [addingTeamToProject, setAddingTeamToProject] = useState<Project | null>(null);
    const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);

    const canCreateTeams = hasPermission('teams:create');
    const canCreateProjects = hasPermission('projects:create');

    // Whether the list is empty because nothing exists, or because a filter
    // is hiding it. The two need opposite advice.
    const filtersActive = anyFilterActive(debouncedSearch, selectedStatus, selectedPmoDivision);

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedStatus(null);
        setSelectedPmoDivision(null);
    };
    const canUpdateTeams = hasPermission('teams:update');
    const canDeleteTeams = hasPermission('teams:delete');


    const fetchData = useCallback(async () => {
        if (localUser?.id) {
            setIsLoading(true);
            try {
                const data = await getProjectsPageData(localUser.id, {
                    status: selectedStatus,
                    pmoDivisionId: selectedPmoDivision,
                    search: debouncedSearch,
                    page: currentPage,
                    pageSize: projectsPerPage,
                });
                setProjects(data.projects);
                setStatuses(data.statuses);
                setAllUsers(data.users || []);
                setPmoDivisions(data.pmoDivisions || []);
                setTotalPages(data.totalPages ?? 1);
                setTotalCount(data.totalCount ?? 0);
            } catch (error) {
                console.error("Failed to fetch projects", error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [localUser?.id, selectedStatus, selectedPmoDivision, debouncedSearch, currentPage]);

    useEffect(() => {
        if (localUser?.id) {
            fetchData();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [localUser, authLoading, fetchData]);

    // The server returns exactly this page, already filtered and searched.
    const paginatedProjects = projects;

    useEffect(() => {
        setCurrentPage(1);
        setExpandedItem(null);
    }, [debouncedSearch, selectedStatus, selectedPmoDivision]);



    const handleTaskAdd = async (data: any, milestoneId?: string) => {
        if (!addingTaskToProject || !localUser) {
             toast({ title: "Error", description: "Could not find the parent project for this task.", variant: "destructive" });
             return;
        }
  
        await addTask(addingTaskToProject.id, milestoneId || null, localUser.id, data);
        toast({ title: "Task Added!", description: `The task "${data.title}" has been added.` });
        setAddingTaskToProject(null);
        await fetchData();
    };

    const handleTaskUpdate = async (projectId: string, updatedTask: TaskType) => {
        if (!editingTaskInfo || !localUser) return;

        const { id, ...dataToUpdate } = updatedTask;
        await updateTask(id, projectId, localUser.id, dataToUpdate);
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

    // Typed, not `any`: this handler passed the dialog's output straight to
    // createTeam, so when that action changed shape the mismatch was invisible
    // to the compiler and only showed up as a crash in the browser.
    const handleTeamSubmit = async (data: Parameters<typeof createTeam>[0]) => {
        const result = editingTeam 
            ? await updateTeam(editingTeam.team.id, data)
            : await createTeam(data);

        if (result.success) {
            toast({
                title: editingTeam ? "Team Updated" : "Team Created",
                description: `The team "${data.name}" has been saved.`
            });
            setIsTeamDialogOpen(false);
            setEditingTeam(null);
            setAddingTeamToProject(null);
            fetchData();
        } else {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive"
            });
        }
    };
  
    const handleTeamDelete = async () => {
        if (!teamToDelete) return;
        const result = await deleteTeam(teamToDelete.id);
        if (result.success) {
            toast({
                title: "Team Deleted",
                description: `Team "${teamToDelete.name}" has been removed.`
            });
            fetchData();
        } else {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive"
            });
        }
        setTeamToDelete(null);
    };

    const handleExpandToggle = (projectId: string, section: 'tasks' | 'teams') => {
        if (expandedItem?.projectId === projectId && expandedItem?.section === section) {
            setExpandedItem(null); // Collapse if the same section is clicked again
        } else {
            setExpandedItem({ projectId, section });
        }
    };

    const handleEditTask = (task: any, project: any) => {
        const normalizedTask = {
            ...task,
            assignedUserIds: task.assignees?.map((a: any) => a.id) || [],
        };
        setEditingTaskInfo({ task: normalizedTask, project });
    };

    const handleAddTeam = (project: Project) => {
        setAddingTeamToProject(project);
        setEditingTeam(null);
        setIsTeamDialogOpen(true);
    };
  
    const handleEditTeam = (team: Team, project: Project) => {
        setEditingTeam({ team, project });
        setAddingTeamToProject(null);
        setIsTeamDialogOpen(true);
    };
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    if (!localUser) {
        return (
            <div className="p-4 sm:p-6"><p>Could not load projects. Please try logging in again.</p></div>
        )
    }
  
    const teamDialogData = editingTeam || (addingTeamToProject ? { project: addingTeamToProject } : null);

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
                    <Select onValueChange={(value) => setSelectedStatus(value === 'all' ? null : value)} value={selectedStatus || 'all'}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {statuses.map(status => (
                                <SelectItem key={status.id} value={status.id}>
                                    {status.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={(value) => setSelectedPmoDivision(value === 'all' ? null : value)} value={selectedPmoDivision || 'all'}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filter by division" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All EPMO Divisions</SelectItem>
                            {pmoDivisions.map(division => (
                                <SelectItem key={division.id} value={division.id}>
                                    {division.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <CreateProjectButton />
                </div>
            </div>
          
            {paginatedProjects.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {paginatedProjects.map((project: any) => (
                        <ProjectListItem 
                            key={project.id} 
                            project={project}
                            users={allUsers}
                            onAddTask={(project) => setAddingTaskToProject(project)}
                            onEditTask={handleEditTask}
                            onDeleteTask={setTaskToDelete}
                            taskToDelete={taskToDelete}
                            setTaskToDelete={setTaskToDelete}
                            handleDeleteTask={handleTaskDelete}
                            onAddTeam={handleAddTeam}
                            onEditTeam={handleEditTeam}
                            onDeleteTeam={setTeamToDelete}
                            canManageTeams={{ create: canCreateTeams, update: canUpdateTeams, delete: canDeleteTeams }}
                            teamToDelete={teamToDelete}
                            setTeamToDelete={setTeamToDelete}
                            handleDeleteTeam={handleTeamDelete}
                            isTasksExpanded={expandedItem?.projectId === project.id && expandedItem?.section === 'tasks'}
                            isTeamsExpanded={expandedItem?.projectId === project.id && expandedItem?.section === 'teams'}
                            onExpandToggle={handleExpandToggle}
                        />
                    ))}
                </div>
            ) : filtersActive ? (
                <EmptyState
                    variant="no-match"
                    title="No projects match your search"
                    description="There are projects here — none of them fit the filters you have set."
                    action={
                        <Button variant="outline" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    }
                />
            ) : (
                <EmptyState
                    title="No projects yet"
                    description={
                        canCreateProjects
                            ? "Register the first project to start tracking it."
                            : "Nothing has been registered yet."
                    }
                    action={
                        canCreateProjects ? (
                            <Button asChild><Link href="/projects/new">New project</Link></Button>
                        ) : undefined
                    }
                />
            )}
          
            {totalPages > 1 && (
                <CardFooter className="flex justify-center items-center gap-4 mt-6">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </CardFooter>
            )}

            {addingTaskToProject && (
                <AddTaskDialog
                    isOpen={!!addingTaskToProject}
                    onOpenChange={(open) => !open && setAddingTaskToProject(null)}
                    project={addingTaskToProject}
                    users={allUsers}
                    onTaskAdd={handleTaskAdd}
                />
            )}

            {editingTaskInfo && (
                <EditTaskDialog
                    isOpen={!!editingTaskInfo}
                    onOpenChange={(open) => !open && setEditingTaskInfo(null)}
                    project={editingTaskInfo.project as any}
                    task={editingTaskInfo.task}
                    users={allUsers}
                    onTaskUpdate={(updatedTask) => handleTaskUpdate(editingTaskInfo.project.id, updatedTask)}
                />
            )}
          
            {teamDialogData && (
                 <TeamDialog
                    isOpen={isTeamDialogOpen}
                    onOpenChange={setIsTeamDialogOpen}
                    team={editingTeam?.team}
                    project={teamDialogData.project}
                    allUsers={allUsers}
                    onSubmit={handleTeamSubmit}
                />
            )}
        </div>
    );
}
