'use client';

import { useMemo } from 'react';
import Link from 'next/link';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { summarizeRag, summarizeSchedule, type ProjectScheduleLike, type RagProjectLike, type StatusLike } from '@/lib/metrics';
import { groupByInitiative, type InitiativeScopedProject } from '@/lib/queries/initiative-scope';
import { cn } from '@/lib/utils';

/**
 * How each strategic initiative is performing.
 *
 * The counterpart of the EPMO division table, and it reads almost the same —
 * but the numbers mean something stronger here. A project has any number of
 * divisions on it, so those rows overlap and cannot be added up. A project has
 * at most one initiative, so these rows are a partition of the portfolio:
 * every project is counted once, the totals sum to the whole, and the share
 * column is therefore a real share rather than a ratio of overlapping tallies.
 *
 * The last row, where it appears, is the work under no initiative at all. It
 * is the row most worth looking at — a portfolio where a third of delivery
 * answers to no strategic commitment is the finding, not a rounding error —
 * so it is shown rather than filtered out of the picture.
 */

type ProjectRow = ProjectScheduleLike &
  RagProjectLike &
  InitiativeScopedProject & {
    id: string;
    name: string;
    statusId: string;
    status: StatusLike;
  };

type InitiativePerformanceProps = {
  projects: ProjectRow[];
  initiatives: { id: string; name: string }[];
  projectStatuses: { id: string; name: string }[];
};

export function InitiativePerformance({
  projects,
  initiatives,
  projectStatuses,
}: InitiativePerformanceProps) {
  const statusMap = useMemo(
    () => new Map(projectStatuses.map((s) => [s.id, s.name])),
    [projectStatuses],
  );

  const rows = useMemo(() => {
    return groupByInitiative(projects, initiatives).map((group) => {
      // The shared metrics, so this table agrees with the KPI row above it
      // rather than carrying its own arithmetic.
      const schedule = summarizeSchedule(group.projects);
      const rag = summarizeRag(group.projects);

      const projectsByStatus = group.projects.reduce(
        (acc, project) => {
          const statusName = statusMap.get(project.statusId) || 'Unknown';
          (acc[statusName] ??= []).push(project);
          return acc;
        },
        {} as Record<string, ProjectRow[]>,
      );

      return {
        ...group,
        totalProjects: group.projects.length,
        share: projects.length > 0 ? (group.projects.length / projects.length) * 100 : 0,
        completionRate: schedule.onTimeRate,
        closedCount: schedule.closed,
        overdueCount: schedule.overdue,
        needsAttention: rag.red + rag.amber,
        projectsByStatus,
      };
    });
  }, [projects, initiatives, statusMap]);

  const defaultOpen = useMemo(
    () => rows.filter((row) => row.totalProjects > 0).map((row) => row.id),
    [rows],
  );

  const placed = rows.filter((r) => !r.unassigned).reduce((sum, r) => sum + r.totalProjects, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Initiative performance</CardTitle>
        <CardDescription>
          {projects.length === 0
            ? 'No projects in this selection.'
            : `${placed} of ${projects.length} project${projects.length === 1 ? '' : 's'} in this selection sit under an initiative. Every project is counted once, so these rows add up to the whole.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="rounded-md border">
            {/* Header row — medium screens and up; each cell repeats its label below that. */}
            <div className="hidden border-b bg-muted/50 p-4 text-sm font-semibold text-muted-foreground md:flex">
              <div className="flex-1">Initiative</div>
              <div className="w-28 text-center">Projects</div>
              <div className="w-28 text-center">Share</div>
              <div className="w-32 text-center">Completion rate</div>
              <div className="w-28 text-center">Overdue</div>
            </div>

            {rows.length > 0 ? (
              <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
                {rows.map((row) => (
                  <AccordionItem value={row.id} key={row.id} className="border-b">
                    <AccordionTrigger className="flex flex-col p-4 text-left hover:bg-muted/30 hover:no-underline md:flex-row">
                      <div
                        className={cn(
                          'mb-2 flex-1 text-base font-semibold md:mb-0',
                          // The unassigned row is a finding rather than an
                          // initiative, and reads as one.
                          row.unassigned && 'italic text-muted-foreground',
                        )}
                      >
                        {row.name}
                      </div>
                      <div className="flex w-full items-center justify-between text-lg font-bold md:w-auto">
                        <div className="text-center md:w-28">
                          <span className="text-sm font-medium text-muted-foreground md:hidden">Projects: </span>
                          {row.totalProjects}
                        </div>
                        <div className="text-center md:w-28">
                          <span className="text-sm font-medium text-muted-foreground md:hidden">Share: </span>
                          {row.share.toFixed(0)}%
                        </div>
                        <div className="text-center md:w-32">
                          <span className="text-sm font-medium text-muted-foreground md:hidden">Completion: </span>
                          {/*
                            A rate over nothing is not 0% — it is unanswerable.
                            Printing 0 for an initiative that has closed no
                            project yet reads as total failure.
                          */}
                          {row.closedCount > 0 ? `${row.completionRate.toFixed(0)}%` : '—'}
                        </div>
                        <div
                          className={cn(
                            'text-center md:w-28',
                            row.overdueCount > 0 && 'text-destructive',
                          )}
                        >
                          <span className="text-sm font-medium text-muted-foreground md:hidden">Overdue: </span>
                          {row.overdueCount}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 bg-muted/20 p-4">
                        {row.needsAttention > 0 && (
                          <p className="text-sm font-medium text-destructive">
                            {row.needsAttention} project{row.needsAttention === 1 ? '' : 's'} rated
                            amber or red.
                          </p>
                        )}
                        {Object.keys(row.projectsByStatus).length > 0 ? (
                          Object.entries(row.projectsByStatus).map(([status, projectList]) => (
                            <div key={status}>
                              <h4 className="mb-2 font-semibold text-muted-foreground">
                                {status} ({projectList.length})
                              </h4>
                              <div className="space-y-2 border-l-2 pl-4">
                                {projectList.map((p) => (
                                  <Tooltip key={p.id}>
                                    <TooltipTrigger asChild>
                                      <Link
                                        href={`/projects/${p.id}`}
                                        className="block truncate text-sm text-primary hover:underline"
                                      >
                                        {p.name}
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{p.name}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="py-4 text-center text-sm text-muted-foreground">
                            No project in this selection is under this initiative.
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No initiatives have been set up yet. They are added on the Initiatives page.
              </div>
            )}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
