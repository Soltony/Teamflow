
'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectButton } from "@/components/projects/create-project-button";
import { getProjectsPageData } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectStatus } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-96 mt-2" />
                    </div>
                    <Skeleton className="h-10 w-36" />
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        <Skeleton className="h-64" />
                        <Skeleton className="h-64" />
                        <Skeleton className="h-64" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function ProjectsPage() {
    const { localUser, hasPermission, loading: authLoading } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

    const isMemberOnly = localUser && !localUser.roles.some(r => r.name === 'Admin' || r.name === 'Project Manager');

    const fetchProjects = useCallback(async () => {
        if (localUser?.id) {
            setIsLoading(true);
            try {
                const data = await getProjectsPageData(localUser.id);
                setProjects(data.projects);
                setStatuses(data.statuses);
            } catch (error) {
                console.error("Failed to fetch projects", error);
                setProjects([]);
                setStatuses([]);
            } finally {
                setIsLoading(false);
            }
        }
    }, [localUser?.id]);

    useEffect(() => {
        if (localUser?.id) {
            fetchProjects();
        } else if (!authLoading) {
            // Auth is done loading and there's no user, stop loading.
            setIsLoading(false);
        }
    }, [localUser, authLoading, fetchProjects]);

    const filteredProjects = useMemo(() => {
        if (!selectedStatus) {
            return projects;
        }
        return projects.filter(p => p.statusId === selectedStatus);
    }, [projects, selectedStatus]);

    if (isLoading || authLoading) {
        return <LoadingSkeleton />;
    }

    if (!localUser) {
        return (
            <div className="p-4 sm:p-6">
                <p>Could not load projects. Please try logging in again.</p>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <CardTitle>Projects</CardTitle>
                        <CardDescription>
                            {isMemberOnly
                                ? "A list of projects you are involved in. Select a project to view its details."
                                : "A list of all projects in the system. Select a project to view its details."}
                        </CardDescription>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row items-center gap-2">
                        <div className="flex items-center gap-2">
                             <Select onValueChange={(value) => setSelectedStatus(value === 'all' ? null : value)} value={selectedStatus || 'all'}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter by status..." />
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
                            {selectedStatus && (
                                <Button variant="ghost" size="icon" onClick={() => setSelectedStatus(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <CreateProjectButton />
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredProjects.length > 0 ? (
                        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProjects.map((project: any) => (
                                <ProjectCard key={project.id} project={project} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">
                                {isMemberOnly
                                    ? "You are not assigned to any projects yet."
                                    : "No projects found. Get started by creating a new one."}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
