'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertOctagon, CheckCircle, Clock, ShieldAlert } from 'lucide-react';

import { ProjectCard } from '@/components/projects/project-card';
import { Card, CardContent } from '@/components/ui/card';
import { DataToolbar, ALL } from '@/components/ui/data-toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader, PageShell } from '@/components/ui/page-header';
import { StatCard, StatCardGrid } from '@/components/ui/stat-card';
import { displayProgress, projectProgress } from '@/lib/metrics';
import { PROJECT_SORT_OPTIONS, sortProjects, type ProjectSort } from '@/lib/ui/sort';

/**
 * The portfolio drill-down.
 *
 * This screen is reached by clicking a KPI on the dashboard, and it used to be
 * entirely inert once you arrived: the report type, the year and the division
 * came from the query string, there were no controls to change any of them, and
 * the result was an unordered, unsearchable, uncounted grid of cards. Switching
 * from "overdue" to "late" meant going back to the dashboard and clicking a
 * different card.
 *
 * Everything the dashboard filtered by is now a control here, and the URL is
 * still the source of truth — so the drill-down links keep working unchanged,
 * a filtered view can be sent to somebody, and the browser's back button does
 * what it looks like it does.
 */

export interface ReportsClientProps {
  projects: any[];
  /** Counts for every report type under the current year and division. */
  counts: { onTime: number; late: number; overdue: number; blockers: number; all: number };
  pmoDivisions: { id: string; name: string }[];
  workingYears: string[];
  type: string;
  year: string;
  division: string;
  title: string;
  description: string;
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All projects' },
  { value: 'on-time', label: 'Completed on time' },
  { value: 'late', label: 'Completed late' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'active-blockers', label: 'With open issues' },
];

export function ReportsClient({
  projects,
  counts,
  pmoDivisions,
  workingYears,
  type,
  year,
  division,
  title,
  description,
}: ReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<ProjectSort>('risk');

  /**
   * Filters live in the URL, so the report is shareable and the back button
   * steps between views. Search and sort stay local — they are how one person
   * reads the list, not what the list is.
   */
  const setParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === ALL) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? projects.filter(
          (p) =>
            String(p.name ?? '').toLowerCase().includes(query) ||
            String(p.description ?? '').toLowerCase().includes(query),
        )
      : projects;
    return sortProjects(filtered, sort);
  }, [projects, search, sort]);

  const averageProgress =
    projects.length > 0
      ? projects.reduce((sum, p) => sum + projectProgress(p), 0) / projects.length
      : 0;

  const reportQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set('year', year);
    if (division !== ALL) params.set('division', division);
    return params.toString();
  }, [year, division]);

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: title }]}
        title={title}
        description={description}
      />

      {/*
        The other report types, with their counts, so somebody who arrived
        looking at "overdue" can see there are also four late ones without
        going back to the dashboard to find out.
      */}
      <StatCardGrid>
        <StatCard
          label="Completed on time"
          metric="onTime"
          icon={CheckCircle}
          tone="positive"
          value={counts.onTime}
          hint={type === 'on-time' ? 'Currently showing' : 'View this report'}
          href={`/reports?type=on-time&${reportQuery}`}
          interactive={type !== 'on-time'}
        />
        <StatCard
          label="Completed late"
          metric="late"
          icon={Clock}
          tone={counts.late > 0 ? 'warning' : 'neutral'}
          value={counts.late}
          hint={type === 'late' ? 'Currently showing' : 'View this report'}
          href={`/reports?type=late&${reportQuery}`}
          interactive={type !== 'late'}
        />
        <StatCard
          label="Overdue"
          metric="overdue"
          icon={AlertOctagon}
          tone={counts.overdue > 0 ? 'critical' : 'positive'}
          value={counts.overdue}
          hint={type === 'overdue' ? 'Currently showing' : 'View this report'}
          href={`/reports?type=overdue&${reportQuery}`}
          interactive={type !== 'overdue'}
        />
        <StatCard
          label="With open issues"
          metric="blockers"
          icon={ShieldAlert}
          tone={counts.blockers > 0 ? 'critical' : 'positive'}
          value={counts.blockers}
          hint={type === 'active-blockers' ? 'Currently showing' : 'View this report'}
          href={`/reports?type=active-blockers&${reportQuery}`}
          interactive={type !== 'active-blockers'}
        />
      </StatCardGrid>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search these projects…',
              label: 'Search projects in this report',
            }}
            filters={[
              {
                id: 'type',
                label: 'Report',
                value: type,
                onChange: (v) => setParam('type', v === ALL ? 'all' : v),
                options: TYPE_OPTIONS,
                allLabel: 'All projects',
              },
              {
                id: 'year',
                label: 'Working year',
                value: year,
                onChange: (v) => setParam('year', v),
                options: workingYears.map((y) => ({ value: y, label: y })),
                allLabel: 'All years',
              },
              {
                id: 'division',
                label: 'EPMO division',
                value: division,
                onChange: (v) => setParam('division', v),
                options: pmoDivisions.map((d) => ({ value: d.id, label: d.name })),
                allLabel: 'All EPMO divisions',
              },
            ]}
            sort={{
              value: sort,
              onChange: (v) => setSort(v as ProjectSort),
              options: PROJECT_SORT_OPTIONS,
            }}
            count={{ showing: visible.length, total: projects.length, noun: 'projects' }}
            onClearAll={() => {
              setSearch('');
              router.push(`${pathname}?type=${type}`);
            }}
          />

          {projects.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Average progress across this report:{' '}
              <span className="font-medium tabular-nums text-foreground">
                {displayProgress(averageProgress)}%
              </span>
            </p>
          )}

          {visible.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((project: any) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  href={
                    type === 'active-blockers'
                      ? `/projects/${project.id}?tab=blockers`
                      : `/projects/${project.id}`
                  }
                />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <EmptyState
              variant="no-match"
              title="No projects match your search"
              description="This report has projects in it — none of them match what you typed."
              compact
            />
          ) : (
            <EmptyState
              variant="no-match"
              title="Nothing in this report"
              description="No project in the selected year and division falls into this category. Widen the filters to see more."
              compact
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
