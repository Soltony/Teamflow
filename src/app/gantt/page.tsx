'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataToolbar, ALL } from '@/components/ui/data-toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader, PageShell } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import {
  GanttTimeline,
  ZOOM_OPTIONS,
  type GanttRow,
  type Zoom,
} from '@/components/schedule/gantt-timeline';
import { getGanttPageData } from './actions';
import { useFirstLoad } from '@/hooks/use-first-load';
import { milestoneProgress } from '@/lib/metrics';
import { milestoneHealth } from '@/lib/ui/health';

/**
 * The whole portfolio against one calendar.
 *
 * The chart this replaces was a Recharts stacked bar with an axis labelled
 * "days from 3 Feb" — no calendar, no today line, no tasks, and a row per
 * milestone with the project name repeated on every one. At forty projects it
 * was several thousand pixels tall and told you almost nothing.
 *
 * Here a project is a collapsible row: collapsed it shows the project's own
 * span, expanded it shows its milestones. Tasks stay on the project's own
 * schedule tab — a portfolio view that drills to individual tasks is a
 * portfolio view nobody can read.
 */

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading the schedule">
      <PageShell>
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[520px] w-full" />
      </PageShell>
    </LoadingRegion>
  );
}

export default function SchedulePage() {
  const { localUser, hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [zoom, setZoom] = useState<Zoom>('month');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setProjects(await getGanttPageData(localUser?.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
    } finally {
      setIsLoading(false);
    }
  }, [localUser?.id]);

  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('gantt:view')) {
        router.replace('/dashboard');
        return;
      }
      if (localUser?.id) load();
      else setIsLoading(false);
    }
  }, [localUser, authLoading, hasPermission, router, load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((p) => String(p.name ?? '').toLowerCase().includes(query));
  }, [projects, search]);

  /**
   * Projects, with their milestones nested one level down.
   *
   * A project with no milestones still gets a row — it has a start and an end,
   * and leaving it out would make the portfolio look smaller than it is.
   */
  const rows: GanttRow[] = useMemo(() => {
    const out: GanttRow[] = [];

    for (const project of visible) {
      const milestones = project.milestones ?? [];
      const progress =
        milestones.length > 0
          ? milestones.reduce((sum: number, m: any) => sum + milestoneProgress(m), 0) /
            milestones.length
          : 0;

      out.push({
        id: project.id,
        kind: 'milestone',
        label: project.name,
        start: new Date(project.startDate),
        end: new Date(project.endDate),
        baselineStart: project.baselineStartDate ? new Date(project.baselineStartDate) : null,
        baselineEnd: project.baselineEndDate ? new Date(project.baselineEndDate) : null,
        progress,
        depth: 0,
      });

      if (!expanded.has(project.id)) continue;

      for (const milestone of milestones) {
        out.push({
          id: `${project.id}:${milestone.id}`,
          kind: 'task',
          parentId: project.id,
          label: milestone.title,
          start: new Date(milestone.startDate),
          end: new Date(milestone.dueDate),
          baselineStart: milestone.baselineStartDate
            ? new Date(milestone.baselineStartDate)
            : null,
          baselineEnd: milestone.baselineDueDate ? new Date(milestone.baselineDueDate) : null,
          progress: milestoneProgress(milestone),
          health: milestoneHealth(milestone),
          depth: 1,
        });
      }
    }

    return out;
  }, [visible, expanded]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allExpanded = visible.length > 0 && visible.every((p) => expanded.has(p.id));

  const showSkeleton = useFirstLoad(isLoading);
  if (showSkeleton || authLoading) return <LoadingSkeleton />;

  return (
    <PageShell>
      <PageHeader
        title="Schedule"
        description="Every project you can see, against one calendar. Expand a project for its milestones, or open it for the task-level view."
      />

      {loadError ? (
        <ErrorState
          variant="load"
          title="We could not load the schedule"
          detail={loadError}
          onRetry={load}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Nothing to schedule"
          description="No project you can see has dates recorded against it yet."
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Portfolio timeline</CardTitle>
                <CardDescription>
                  Committed dates are drawn as a dashed bar beneath the current plan, so a slip
                  shows without having to be looked up.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setExpanded(allExpanded ? new Set() : new Set(visible.map((p) => p.id)))
                  }
                >
                  {allExpanded ? (
                    <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
                  )}
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </Button>
                <Select value={zoom} onValueChange={(v) => setZoom(v as Zoom)}>
                  <SelectTrigger className="w-[130px]" aria-label="Timeline zoom">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZOOM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataToolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search projects…',
                label: 'Search projects on the timeline',
              }}
              count={{ showing: visible.length, total: projects.length, noun: 'projects' }}
              onClearAll={() => setSearch('')}
            />

            {visible.length === 0 ? (
              <EmptyState
                variant="no-match"
                title="No projects match"
                description="There are projects on the timeline — none of them match what you typed."
                compact
              />
            ) : (
              <GanttTimeline
                rows={rows}
                zoom={zoom}
                expanded={expanded}
                onToggleExpand={toggle}
                // Rescheduling happens on a project's own schedule tab, where
                // the milestone-contains-its-tasks rule can be explained. A
                // portfolio view is for reading.
                canReschedule={false}
                height={560}
              />
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
