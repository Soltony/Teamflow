'use client';

import { useEffect, useState, useCallback } from "react";

import { useAuth } from "@/context/auth-context";
import { ProjectCard } from "@/components/projects/project-card";
import { getArchivedProjects } from "./actions";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { DataToolbar, ALL } from "@/components/ui/data-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@prisma/client";
import type { Serialized } from '@/lib/serialize';
import { anyFilterActive } from "@/lib/ui/empty-state";
import { useFirstLoad } from "@/hooks/use-first-load";

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading the archive">
          <PageShell>
              <div className="space-y-2">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-10 w-full" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  <Skeleton className="h-56" />
                  <Skeleton className="h-56" />
                  <Skeleton className="h-56" />
                  <Skeleton className="h-56" />
              </div>
          </PageShell>
        </LoadingRegion>
    )
}

export default function ArchivePage() {
    const { localUser, loading: authLoading } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<Serialized<ProjectStatus>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string>(ALL);
    const [searchQuery, setSearchQuery] = useState('');
    /** Searching runs in the database now, so wait for a pause before querying. */
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const projectsPerPage = 12;

    const fetchProjects = useCallback(async () => {
        if (!localUser?.id) return;

        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getArchivedProjects(localUser.id, {
                page: currentPage,
                pageSize: projectsPerPage,
                search: debouncedSearch,
                status: selectedStatus === ALL ? null : selectedStatus,
            });
            setProjects(data.projects);
            setStatuses(data.statuses);
            setTotalPages(data.totalPages ?? 1);
            setTotalCount(data.totalCount ?? data.projects.length);
        } catch (error) {
            // Previously this emptied the list and logged to the console, which
            // is indistinguishable from an archive that genuinely has nothing
            // in it.
            setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
        } finally {
            setIsLoading(false);
        }
    }, [localUser?.id, currentPage, debouncedSearch, selectedStatus]);

    useEffect(() => {
        if (localUser?.id) {
            fetchProjects();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [localUser, authLoading, fetchProjects]);

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
            <PageShell>
                <ErrorState
                    variant="permission"
                    title="Your session has ended"
                    description="Sign in again to see the archive."
                    href="/login"
                    hrefLabel="Sign in"
                />
            </PageShell>
        );
    }

    const filtersActive = anyFilterActive(debouncedSearch, selectedStatus);

    const clearAll = () => {
        setSearchQuery('');
        setSelectedStatus(ALL);
    };

    return (
        <PageShell>
            <PageHeader
                title="Archive"
                description="Projects that have been completed or handed over. They no longer count towards the active portfolio."
            />

            <DataToolbar
                search={{
                    value: searchQuery,
                    onChange: setSearchQuery,
                    placeholder: 'Search archived projects…',
                    label: 'Search archived projects',
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
                ]}
                count={{ showing: projects.length, total: totalCount, noun: 'projects' }}
                onClearAll={clearAll}
            />

            {loadError ? (
                <ErrorState
                    variant="load"
                    title="We could not load the archive"
                    detail={loadError}
                    onRetry={fetchProjects}
                />
            ) : projects.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {projects.map((project: any) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            ) : (
                <EmptyState
                    variant={filtersActive ? "no-match" : "empty"}
                    title={
                        filtersActive
                            ? "No archived projects match your search"
                            : "Nothing has been archived"
                    }
                    description={
                        filtersActive
                            ? "There are archived projects — none of them fit the filters you have set."
                            : "Projects appear here once their status is set to Completed or On handover."
                    }
                    action={
                        filtersActive ? (
                            <Button variant="outline" onClick={clearAll}>Clear filters</Button>
                        ) : undefined
                    }
                />
            )}

            {totalPages > 1 && !loadError && (
                <nav
                    aria-label="Archive pagination"
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
        </PageShell>
    );
}
