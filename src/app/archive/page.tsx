
'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { getArchivedProjects } from "./actions";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import type { ProjectStatus } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import type { Serialized } from '@/lib/serialize';
import { EmptyState } from "@/components/ui/empty-state";
import { anyFilterActive } from "@/lib/ui/empty-state";
import { useFirstLoad } from "@/hooks/use-first-load";

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading archive">
          <div className="p-4 sm:p-6 space-y-6">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                          <Skeleton className="h-8 w-48" />
                          <Skeleton className="h-4 w-96 mt-2" />
                      </div>
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
        </LoadingRegion>
    )
}

export default function ArchivePage() {
    const { localUser, loading: authLoading } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<Serialized<ProjectStatus>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    /** Searching runs in the database now, so wait for a pause before querying. */
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const projectsPerPage = 12;

    const fetchProjects = useCallback(async () => {
        if (localUser?.id) {
            setIsLoading(true);
            try {
                const data = await getArchivedProjects(localUser.id, {
                    page: currentPage,
                    pageSize: projectsPerPage,
                    search: debouncedSearch,
                    status: selectedStatus,
                });
                setProjects(data.projects);
                setStatuses(data.statuses);
                setTotalPages(data.totalPages ?? 1);
            } catch (error) {
                console.error("Failed to fetch archived projects", error);
                setProjects([]);
                setStatuses([]);
            } finally {
                setIsLoading(false);
            }
        }
    }, [localUser?.id, currentPage, debouncedSearch, selectedStatus]);

    useEffect(() => {
        if (localUser?.id) {
            fetchProjects();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [localUser, authLoading, fetchProjects]);

    const paginatedProjects = projects;
  
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedStatus, debouncedSearch]);
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);



    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    if (!localUser) {
        return (
            <div className="p-4 sm:p-6">
                <p>Could not load archived projects. Please try logging in again.</p>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <CardTitle>Archived Projects</CardTitle>
                        <CardDescription>
                            A list of all completed or handed-over projects.
                        </CardDescription>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row items-center gap-2">
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search projects..."
                                className="w-full rounded-lg bg-background pl-8 sm:w-[200px] lg:w-[250px]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                             <Select onValueChange={(value) => setSelectedStatus(value === 'all' ? null : value)} value={selectedStatus || 'all'}>
                                <SelectTrigger className="w-full sm:w-[180px]">
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
                    </div>
                </CardHeader>
                <CardContent>
                    {paginatedProjects.length > 0 ? (
                        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {paginatedProjects.map((project: any) => (
                                <ProjectCard key={project.id} project={project} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            variant={anyFilterActive(debouncedSearch, selectedStatus) ? "no-match" : "empty"}
                            title={
                                anyFilterActive(debouncedSearch, selectedStatus)
                                    ? "No archived projects match your search"
                                    : "Nothing has been archived"
                            }
                            description={
                                anyFilterActive(debouncedSearch, selectedStatus)
                                    ? "There are archived projects — none of them fit the filters you have set."
                                    : "Projects appear here once their status is set to an archived one."
                            }
                        />
                    )}
                </CardContent>
                {totalPages > 1 && (
                    <CardFooter className="flex justify-center items-center gap-4">
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
            </Card>
        </div>
    );
}

    