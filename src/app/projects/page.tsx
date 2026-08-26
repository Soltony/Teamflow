'use client';

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { useAuth } from "@/context/auth-context";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { anyFilterActive } from "@/lib/ui/empty-state";
import { ProjectListItem } from "@/components/projects/project-card";
import { CreateProjectButton } from "@/components/projects/create-project-button";
import { getProjectsPageData, addTask, updateTask, deleteTask } from "./actions";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { DataToolbar, ALL } from "@/components/ui/data-toolbar";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import type { Task as TaskType, Project, Milestone, ProjectStatus, PmoDivision, Team, UserWithRoles } from "@/lib/types";
import { AddTaskDialog } from "@/components/projects/add-task-dialog";
import { EditTaskDialog } from "@/components/projects/edit-task-dialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TeamDialog } from "@/components/teams/team-dialog";
import { createTeam, updateTeam, deleteTeam } from "@/app/teams/actions";
import { useFirstLoad } from "@/hooks/use-first-load";

/**
 * Orderings this list offers.
 *
 * Only what the database can order by — see PROJECT_LIST_ORDER in the action.
 * "Most at risk" belongs on Reports, where the whole set is in hand rather
 * than one page of nine.
 */
const SORT_OPTIONS = [
  { value: 'created', label: 'Newest first' },
  { value: 'deadline', label: 'Deadline, soonest first' },
  { value: 'deadline-desc', label: 'Deadline, latest first' },
  { value: 'recent', label: 'Recently updated' },
  { value: 'name', label: 'Name, A to Z' },
];

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading projects">
          <PageShell>
              <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-9 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-10 w-36" />
              </div>
              <Skeleton className="h-10 w-full" />
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
              </div>
          </PageShell>
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
    const [loadError, setLoadError] = useState<string | null>(null);
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

    const [selectedStatus, setSelectedStatus] = useState<string>(ALL);
    const [selectedPmoDivision, setSelectedPmoDivision] = useState<string>(ALL);
    const [sort, setSort] = useState('created');

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
    const canUpdateTeams = hasPermission('teams:update');
    const canDeleteTeams = hasPermission('teams:delete');

    // Whether the list is empty because nothing exists, or because a filter
    // is hiding it. The two need opposite advice.
    const filtersActive = anyFilterActive(debouncedSearch, selectedStatus, selectedPmoDivision);

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedStatus(ALL);
        setSelectedPmoDivision(ALL);
    };

    const fetchData = useCallback(async () => {
        if (!localUser?.id) return;

        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getProjectsPageData(localUser.id, {
                status: selectedStatus === ALL ? null : selectedStatus,
                pmoDivisionId: selectedPmoDivision === ALL ? null : selectedPmoDivision,
                search: debouncedSearch,
                page: currentPage,
                pageSize: projectsPerPage,
                sort,
            });
            setProjects(data.projects);
            setStatuses(data.statuses);
            setAllUsers(data.users || []);
            setPmoDivisions(data.pmoDivisions || []);
            setTotalPages(data.totalPages ?? 1);
            setTotalCount(data.totalCount ?? 0);
        } catch (error) {
            // Previously logged to the console, leaving the page showing an
            // empty grid and telling the reader to create their first project.
            setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
        } finally {
            setIsLoading(false);
        }
    }, [localUser?.id, selectedStatus, selectedPmoDivision, debouncedSearch, currentPage, sort]);

    useEffect(() => {
        if (localUser?.id) {
            fetchData();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [localUser, authLoading, fetchData]);

    // The server returns exactly this page, already filtered, searched and
    // ordered.
    const paginatedProjects = projects;

    useEffect(() => {
        setCurrentPage(1);
        setExpandedItem(null);
    }, [debouncedSearch, selectedStatus, selectedPmoDivision, sort]);

    const handleTaskAdd = async (data: any, milestoneId?: string) => {
        if (!addingTaskToProject || !localUser) {
             toast({ title: "That did not work", description: "Could not find the parent project for this task.", variant: "destructive" });
             return;
        }

        await addTask(addingTaskToProject.id, milestoneId || null, localUser.id, data);
        toast({ title: "Task added", description: `"${data.title}" is now on the project.` });
        setAddingTaskToProject(null);
        await fetchData();
    };

    const handleTaskUpdate = async (projectId: string, updatedTask: TaskType) => {
        if (!editingTaskInfo || !localUser) return;

        const { id, ...dataToUpdate } = updatedTask;
        await updateTask(id, projectId, localUser.id, dataToUpdate);
        toast({ title: "Task updated" });
        setEditingTaskInfo(null);
        await fetchData();
    };

    const handleTaskDelete = async () => {
        if (!taskToDelete) return;

        const projectForTask = projects.find(p => p.milestones.some((m: Milestone) => m.tasks.some((t: TaskType) => t.id === taskToDelete.id)));

        const result = await deleteTask(taskToDelete.id, projectForTask?.id || '');
        if (result.success) {
            toast({ title: "Task deleted", description: `"${taskToDelete.title}" has been removed.` });
            await fetchData();
        } else {
            toast({ title: "That did not work", description: result.error, variant: "destructive" });
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
                title: editingTeam ? "Team updated" : "Team created",
                description: `"${data.name}" has been saved.`
            });
            setIsTeamDialogOpen(false);
            setEditingTeam(null);
            setAddingTeamToProject(null);
            fetchData();
        } else {
            toast({ title: "That did not work", description: result.error, variant: "destructive" });
        }
    };

    const handleTeamDelete = async () => {
        if (!teamToDelete) return;
        const result = await deleteTeam(teamToDelete.id);
        if (result.success) {
            toast({ title: "Team deleted", description: `"${teamToDelete.name}" has been removed.` });
            fetchData();
        } else {
            toast({ title: "That did not work", description: result.error, variant: "destructive" });
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
            <PageShell>
                <ErrorState
                    variant="permission"
                    title="Your session has ended"
                    description="Sign in again to see the projects you have access to."
                    href="/login"
                    hrefLabel="Sign in"
                />
            </PageShell>
        );
    }

    const teamDialogData = editingTeam || (addingTeamToProject ? { project: addingTeamToProject } : null);

    return (
        <PageShell>
            <PageHeader
                title="Projects"
                description="Everything currently in delivery. Completed and handed-over projects live in the Archive."
                actions={<CreateProjectButton />}
            />

            <DataToolbar
                search={{
                    value: searchQuery,
                    onChange: setSearchQuery,
                    placeholder: 'Search projects…',
                    label: 'Search projects by name or description',
                }}
                filters={[
                    {
                        id: 'status',
                        label: 'Status',
                        value: selectedStatus,
                        onChange: setSelectedStatus,
                        options: statuses.map((s) => ({ value: s.id, label: s.name })),
                        allLabel: 'All statuses',
                    },
                    {
                        id: 'division',
                        label: 'EPMO division',
                        value: selectedPmoDivision,
                        onChange: setSelectedPmoDivision,
                        options: pmoDivisions.map((d) => ({ value: d.id, label: d.name })),
                        allLabel: 'All EPMO divisions',
                    },
                ]}
                sort={{ value: sort, onChange: setSort, options: SORT_OPTIONS }}
                count={{
                    showing: paginatedProjects.length,
                    total: totalCount,
                    noun: 'projects',
                }}
                onClearAll={clearFilters}
            />

            {loadError ? (
                <ErrorState
                    variant="load"
                    title="We could not load your projects"
                    detail={loadError}
                    onRetry={fetchData}
                />
            ) : paginatedProjects.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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

            {totalPages > 1 && !loadError && (
                <nav
                    aria-label="Projects pagination"
                    className="flex flex-wrap items-center justify-center gap-4"
                >
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </nav>
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
        </PageShell>
    );
}
