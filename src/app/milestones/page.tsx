'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowRight, CalendarDays, Scale } from 'lucide-react';

import { useAuth } from "@/context/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DataToolbar, ALL } from "@/components/ui/data-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { HealthPill } from "@/components/ui/status-pill";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getMilestonesPageData } from './actions';
import { useFirstLoad } from "@/hooks/use-first-load";
import {
  displayProgress,
  milestoneProgress as calculateMilestoneProgress,
  projectProgress as calculateProjectProgress,
} from '@/lib/metrics';
import {
  daysUntil,
  milestoneHealth,
  summarizeMilestoneHealth,
  type Health,
} from '@/lib/ui/health';
import { MILESTONE_SORT_OPTIONS, sortMilestones, type MilestoneSort } from '@/lib/ui/sort';

type ProjectWithMilestones = Awaited<ReturnType<typeof getMilestonesPageData>>[number];

/**
 * Every milestone across the portfolio.
 *
 * The screen this replaces was a single accordion of projects, ordered by
 * creation date, with no search, no filter and no sort — and each milestone
 * showed a progress bar with no indication of whether that progress was good.
 * Finding the milestone that had slipped meant expanding every project in turn
 * and reading the due dates.
 *
 * This is the one screen in the system whose entire job is "which milestones
 * are in trouble", so it now opens with that count and defaults to ordering by
 * it.
 */

const HEALTH_FILTER_OPTIONS = [
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'AT_RISK', label: 'Behind schedule' },
  { value: 'ON_TRACK', label: 'On track' },
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'COMPLETE', label: 'Complete' },
];

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading milestones">
          <PageShell>
            <div className="space-y-2">
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </PageShell>
        </LoadingRegion>
    )
}

export default function AllMilestonesPage() {
  const { localUser, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectWithMilestones[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [health, setHealth] = useState<string>(ALL);
  const [project, setProject] = useState<string>(ALL);
  const [sort, setSort] = useState<MilestoneSort>('health');

  const load = useCallback(async () => {
      if (!localUser?.id) return;
      setIsLoading(true);
      setLoadError(null);
      try {
          setProjects(await getMilestonesPageData(localUser.id));
      } catch (error) {
          setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
      } finally {
          setIsLoading(false);
      }
  }, [localUser?.id]);

  useEffect(() => {
      if (localUser?.id) {
          load();
      } else if (!authLoading) {
          setIsLoading(false);
      }
  }, [localUser, authLoading, load]);

  /**
   * Milestones, flattened out of their projects.
   *
   * The nesting was how the data arrived, not how anybody reads it: a question
   * like "what is overdue this month" spans projects, and grouping by project
   * is precisely what stops it being answerable.
   */
  const allMilestones = useMemo(
    () =>
      projects.flatMap((p: any) =>
        (p.milestones ?? []).map((m: any) => ({ ...m, project: p })),
      ),
    [projects],
  );

  const counts = useMemo(() => summarizeMilestoneHealth(allMilestones), [allMilestones]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = allMilestones.filter((m: any) => {
      if (health !== ALL && milestoneHealth(m) !== health) return false;
      if (project !== ALL && m.project.id !== project) return false;
      if (!query) return true;
      return (
        String(m.title ?? '').toLowerCase().includes(query) ||
        String(m.description ?? '').toLowerCase().includes(query) ||
        String(m.project.name ?? '').toLowerCase().includes(query)
      );
    });

    return sortMilestones(filtered, sort);
  }, [allMilestones, search, health, project, sort]);

  /** Grouped back up for display, but only after filtering across the flat list. */
  const grouped = useMemo(() => {
    const byProject = new Map<string, { project: any; milestones: any[] }>();
    for (const milestone of visible) {
      const entry = byProject.get(milestone.project.id);
      if (entry) entry.milestones.push(milestone);
      else byProject.set(milestone.project.id, { project: milestone.project, milestones: [milestone] });
    }
    return [...byProject.values()];
  }, [visible]);

  const projectOptions = useMemo(
    () => projects.map((p: any) => ({ value: p.id, label: p.name })),
    [projects],
  );

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
          description="Sign in again to see the milestones you have access to."
          href="/login"
          hrefLabel="Sign in"
        />
      </PageShell>
    );
  }

  const isMemberOnly =
    !localUser.roles.some((r) => r.name === 'Admin' || r.name === 'Project Manager');

  const clearAll = () => {
    setSearch('');
    setHealth(ALL);
    setProject(ALL);
  };

  return (
    <PageShell>
      <PageHeader
        title="Milestones"
        description={
          isMemberOnly
            ? "Milestones from the projects you are involved in, and whether each will make its date."
            : "Every milestone across the portfolio, and whether each will make its date."
        }
      />

      {loadError ? (
        <ErrorState
          variant="load"
          title="We could not load the milestones"
          detail={loadError}
          onRetry={load}
        />
      ) : allMilestones.length === 0 ? (
        <EmptyState
          variant={isMemberOnly ? 'none-yours' : 'empty'}
          title={isMemberOnly ? 'No milestones on your projects' : 'No milestones yet'}
          description={
            isMemberOnly
              ? "The projects you are on have not been broken into milestones yet."
              : "Milestones appear here once projects are broken down into them."
          }
        />
      ) : (
        <>
          <StatCardGrid>
            <StatCard
              label="Overdue"
              value={counts.overdue}
              tone={counts.overdue > 0 ? 'critical' : 'positive'}
              hint="past their due date and unfinished"
              interactive={false}
            />
            <StatCard
              label="Behind schedule"
              value={counts.atRisk}
              tone={counts.atRisk > 0 ? 'warning' : 'positive'}
              hint="progress trailing elapsed time"
              interactive={false}
            />
            <StatCard
              label="On track"
              value={counts.onTrack + counts.notStarted}
              tone="neutral"
              hint={`${counts.notStarted} not started yet`}
              interactive={false}
            />
            <StatCard
              label="Complete"
              value={counts.complete}
              tone="positive"
              hint={`of ${counts.total} milestones in total`}
              interactive={false}
            />
          </StatCardGrid>

          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search milestones or projects…',
              label: 'Search milestones',
            }}
            filters={[
              {
                id: 'health',
                label: 'Health',
                value: health,
                onChange: setHealth,
                options: HEALTH_FILTER_OPTIONS,
                allLabel: 'Any health',
              },
              {
                id: 'project',
                label: 'Project',
                value: project,
                onChange: setProject,
                options: projectOptions,
                allLabel: 'All projects',
              },
            ]}
            sort={{
              value: sort,
              onChange: (v) => setSort(v as MilestoneSort),
              options: MILESTONE_SORT_OPTIONS,
            }}
            count={{ showing: visible.length, total: allMilestones.length, noun: 'milestones' }}
            onClearAll={clearAll}
          />

          {visible.length === 0 ? (
            <EmptyState
              variant="no-match"
              title="No milestones match"
              description="There are milestones here — none of them fit the filters you have set."
            />
          ) : (
            <Accordion type="multiple" defaultValue={grouped.map((g) => g.project.id)} className="space-y-3">
              {grouped.map(({ project: proj, milestones }) => {
                const progress = calculateProjectProgress(proj);
                const projCounts = summarizeMilestoneHealth(milestones);
                const needsAttention = projCounts.overdue + projCounts.atRisk;

                return (
                  <AccordionItem
                    key={proj.id}
                    value={proj.id}
                    className="rounded-md border bg-card px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex w-full flex-col gap-3 pr-2 text-left lg:flex-row lg:items-center lg:gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{proj.name}</span>
                            {needsAttention > 0 && (
                              <Badge variant="destructive" className="font-normal">
                                {needsAttention} need attention
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-normal text-muted-foreground">
                            {milestones.length} milestone{milestones.length === 1 ? '' : 's'} shown ·{' '}
                            {projCounts.complete} complete
                          </p>
                        </div>
                        <div className="flex w-full items-center gap-3 lg:w-56 lg:shrink-0">
                          <Progress
                            value={progress}
                            className="h-2 flex-1"
                            aria-label={`${proj.name}: ${displayProgress(progress)}% complete`}
                          />
                          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                            {displayProgress(progress)}%
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pb-4 pt-1">
                      <ul className="space-y-2">
                        {milestones.map((milestone: any) => (
                          <MilestoneRow
                            key={milestone.id}
                            milestone={milestone}
                            projectId={proj.id}
                            departments={proj.responsibleDepartments ?? []}
                          />
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </>
      )}
    </PageShell>
  );
}

function MilestoneRow({
  milestone,
  projectId,
  departments,
}: {
  milestone: any;
  projectId: string;
  departments: any[];
}) {
  const progress = calculateMilestoneProgress(milestone);
  const health = milestoneHealth(milestone);
  const remaining = daysUntil(milestone);
  const tasks: any[] = milestone.tasks ?? [];
  const done = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <li>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{milestone.title}</h3>
                <HealthPill health={health} label={healthLabel(health, remaining)} />
              </div>
              {milestone.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{milestone.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3 sm:w-44 sm:shrink-0">
              <Progress
                value={progress}
                className="h-2 flex-1"
                aria-label={`${milestone.title}: ${displayProgress(progress)}% complete`}
              />
              <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">
                {displayProgress(progress)}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              Due {format(parseISO(milestone.dueDate), 'd MMM yyyy')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Scale className="h-3 w-3" aria-hidden="true" />
              Weight {milestone.weight}%
            </span>
            <span>
              {done} of {tasks.length} task{tasks.length === 1 ? '' : 's'} done
            </span>
            {departments.slice(0, 2).map((dept: any) => (
              <Badge key={dept.id} variant="secondary" className="font-normal">
                {dept.name}
              </Badge>
            ))}
          </div>

          <Link
            href={`/projects/${projectId}?tab=milestones`}
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open in the project
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </li>
  );
}

/** Specific where a number helps: "9 days late" beats "Overdue". */
function healthLabel(health: Health, remaining: number | null): string | undefined {
  if (remaining === null) return undefined;
  if (health === 'OVERDUE') {
    const late = Math.abs(remaining);
    return `${late} day${late === 1 ? '' : 's'} late`;
  }
  if (health === 'AT_RISK' && remaining >= 0) {
    return `Behind · ${remaining} day${remaining === 1 ? '' : 's'} left`;
  }
  return undefined;
}
