'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertOctagon, CheckCircle, Clock, ShieldAlert, Target, TrendingDown, TrendingUp } from 'lucide-react';

import { ProjectCard } from '@/components/projects/project-card';
import { PmoDivisionPerformance } from '@/components/ceo-report/pmo-division-performance';
import { ProjectStatusChart } from '@/components/dashboard/project-status-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataToolbar, ALL } from '@/components/ui/data-toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader, PageShell } from '@/components/ui/page-header';
import { SectionLayout, SectionNav, SectionPanel, type Section } from '@/components/ui/section-nav';
import { StatCard, StatCardGrid } from '@/components/ui/stat-card';
import { RagPill } from '@/components/ui/status-pill';
import { MetricInfo } from '@/components/metrics/metric-info';
import { displayProgress, projectProgress, type PortfolioRag } from '@/lib/metrics';
import { PROJECT_SORT_OPTIONS, sortProjects, type ProjectSort } from '@/lib/ui/sort';
import { cn } from '@/lib/utils';

/**
 * The portfolio, and the projects behind every figure in it.
 *
 * One screen replacing two. The top half is the position — RAG spread,
 * on-time rate, the variances — and the bottom half is the drill-down that
 * used to be a separate page. Both honour the same year and division filters,
 * which is the thing the split made impossible: the old portfolio page had no
 * filters at all, so it could not be reconciled with a filtered drill-down.
 */

export interface ReportsClientProps {
  projects: any[];
  allProjects: any[];
  projectStatuses: any[];
  portfolio: {
    rag: PortfolioRag;
    activeCount: number;
    onTimeRate: number;
    closedCount: number;
    overdueCount: number;
    openBlockerCount: number;
  };
  counts: {
    onTime: number;
    late: number;
    overdue: number;
    blockers: number;
    atRisk: number;
    all: number;
  };
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
  { value: 'at-risk', label: 'At risk' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'active-blockers', label: 'With open issues' },
  { value: 'on-time', label: 'Completed on time' },
  { value: 'late', label: 'Completed late' },
];

export function ReportsClient({
  projects,
  allProjects,
  projectStatuses,
  portfolio,
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
  const [section, setSection] = React.useState('portfolio');

  /**
   * Filters live in the URL, so a report is shareable and the back button
   * steps between views. Search and sort stay local — they are how one person
   * reads the list, not what the list is.
   */
  const setParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === ALL) params.delete(key);
      else params.set(key, value);
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

  const scope = React.useMemo(() => {
    const divisionName =
      division === ALL
        ? 'all EPMO divisions'
        : (pmoDivisions.find((d) => d.id === division)?.name ?? 'one division');
    return `${divisionName}, ${year === ALL ? 'all working years' : year}`;
  }, [division, year, pmoDivisions]);

  const sections: Section[] = [
    {
      id: 'portfolio',
      label: 'Portfolio position',
      count: portfolio.rag.total,
      description: 'RAG spread, delivery rate and variances',
    },
    {
      id: 'drilldown',
      label: title,
      count: projects.length,
      attention: type === 'at-risk' || type === 'overdue',
      description: 'The projects behind the figures',
    },
    {
      id: 'divisions',
      label: 'By EPMO division',
      count: pmoDivisions.length,
      description: 'How each division is performing',
    },
  ];

  const filters = [
    {
      id: 'year',
      label: 'Working year',
      value: year,
      onChange: (v: string) => setParam('year', v),
      options: workingYears.map((y) => ({ value: y, label: y })),
      allLabel: 'All years',
    },
    {
      id: 'division',
      label: 'EPMO division',
      value: division,
      onChange: (v: string) => setParam('division', v),
      options: pmoDivisions.map((d) => ({ value: d.id, label: d.name })),
      allLabel: 'All EPMO divisions',
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description={`The portfolio and the projects behind it — ${scope}.`}
      >
        {/*
          The scope filters sit in the header rather than inside a section,
          because they govern every section beneath. The old split had the
          summary unfiltered and the drill-down filtered, which is how the two
          pages came to disagree.
        */}
        <DataToolbar filters={filters} onClearAll={() => router.push(pathname)} />
      </PageHeader>

      <SectionLayout
        nav={
          <SectionNav
            sections={sections}
            value={section}
            onValueChange={setSection}
            label="Report sections"
          />
        }
      >
        <SectionPanel id="portfolio" active={section === 'portfolio'}>
          <div className="space-y-6">
            <RagSummary rag={portfolio.rag} onDrillDown={() => { setParam('type', 'at-risk'); setSection('drilldown'); }} />

            <StatCardGrid>
              <StatCard
                label="Active projects"
                icon={Target}
                value={portfolio.activeCount}
                hint="currently in delivery"
                href="/projects"
                interactive={portfolio.activeCount > 0}
              />
              <StatCard
                label="On-time completion rate"
                metric="onTimeRate"
                icon={CheckCircle}
                tone={portfolio.onTimeRate >= 80 ? 'positive' : portfolio.onTimeRate >= 50 ? 'warning' : 'critical'}
                value={portfolio.closedCount > 0 ? `${Math.round(portfolio.onTimeRate)}%` : 'N/A'}
                progress={portfolio.closedCount > 0 ? portfolio.onTimeRate : undefined}
                hint={
                  portfolio.closedCount > 0
                    ? `across ${portfolio.closedCount} closed project${portfolio.closedCount === 1 ? '' : 's'}`
                    : 'nothing has closed yet'
                }
                interactive={false}
              />
              <StatCard
                label="Overdue"
                metric="overdue"
                icon={AlertOctagon}
                tone={portfolio.overdueCount > 0 ? 'critical' : 'positive'}
                value={portfolio.overdueCount}
                hint="still running, past their deadline"
                href={`/reports?type=overdue&year=${year}${division !== ALL ? `&division=${division}` : ''}`}
                interactive={portfolio.overdueCount > 0}
              />
              <StatCard
                label="Open issues"
                metric="blockers"
                icon={ShieldAlert}
                tone={portfolio.openBlockerCount > 0 ? 'critical' : 'positive'}
                value={portfolio.openBlockerCount}
                hint="unresolved across the portfolio"
                href={`/reports?type=active-blockers&year=${year}${division !== ALL ? `&division=${division}` : ''}`}
                interactive={portfolio.openBlockerCount > 0}
              />
            </StatCardGrid>

            <div className="grid gap-6 lg:grid-cols-2">
              <VarianceCard
                label="Average schedule variance"
                value={portfolio.rag.averageScheduleVariance}
                positiveHint="ahead of plan on average"
                negativeHint="behind plan on average"
                explanation="Completion minus elapsed time, averaged across the projects that have both."
              />
              <VarianceCard
                label="Average budget variance"
                value={portfolio.rag.averageBudgetVariance}
                positiveHint="delivery ahead of spend"
                negativeHint="spend ahead of delivery"
                explanation="Delivery minus committed spend, as a share of budget. Only projects with a budget are counted."
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projects by status</CardTitle>
                <CardDescription>How the portfolio is distributed right now.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectStatusChart projects={allProjects} projectStatuses={projectStatuses} />
              </CardContent>
            </Card>
          </div>
        </SectionPanel>

        <SectionPanel id="drilldown" active={section === 'drilldown'}>
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                ]}
                sort={{
                  value: sort,
                  onChange: (v) => setSort(v as ProjectSort),
                  options: PROJECT_SORT_OPTIONS,
                }}
                count={{ showing: visible.length, total: projects.length, noun: 'projects' }}
                onClearAll={() => {
                  setSearch('');
                  setParam('type', 'all');
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
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((project: any) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      href={
                        type === 'active-blockers'
                          ? `/projects/${project.id}?tab=risks`
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
                  description={`No project in ${scope} falls into this category. Widen the filters above to see more.`}
                  compact
                />
              )}
            </CardContent>
          </Card>
        </SectionPanel>

        <SectionPanel id="divisions" active={section === 'divisions'}>
          <PmoDivisionPerformance
            projects={allProjects}
            pmoDivisions={pmoDivisions as any}
            projectStatuses={projectStatuses}
          />
        </SectionPanel>
      </SectionLayout>
    </PageShell>
  );
}

/**
 * The RAG spread as a single bar.
 *
 * A bar rather than four numbers because the question is proportion — "how
 * much of the portfolio is in trouble" — and four counts make the reader do
 * the division. Each segment is labelled, so the colours are a convenience
 * rather than the message.
 */
function RagSummary({ rag, onDrillDown }: { rag: PortfolioRag; onDrillDown: () => void }) {
  const parts = [
    { key: 'RED' as const, count: rag.red, className: 'bg-destructive', label: 'In trouble' },
    { key: 'AMBER' as const, count: rag.amber, className: 'bg-warning', label: 'At risk' },
    { key: 'GREEN' as const, count: rag.green, className: 'bg-success', label: 'On track' },
    { key: 'COMPLETE' as const, count: rag.complete, className: 'bg-muted-foreground/40', label: 'Complete' },
  ].filter((p) => p.count > 0);

  const needsAttention = rag.red + rag.amber;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Portfolio health</CardTitle>
          {needsAttention > 0 && (
            <button
              type="button"
              onClick={onDrillDown}
              className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              See the {needsAttention} needing attention
            </button>
          )}
        </div>
        <CardDescription>
          {rag.total === 0
            ? 'No projects in this selection.'
            : `${rag.total} project${rag.total === 1 ? '' : 's'}, rated on schedule and budget together.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rag.total > 0 && (
          <>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={parts.map((p) => `${p.count} ${p.label}`).join(', ')}
            >
              {parts.map((part) => (
                <div
                  key={part.key}
                  className={cn('h-full', part.className)}
                  style={{ width: `${(part.count / rag.total) * 100}%` }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {(['RED', 'AMBER', 'GREEN', 'COMPLETE'] as const).map((key) => {
                const count =
                  key === 'RED' ? rag.red : key === 'AMBER' ? rag.amber : key === 'GREEN' ? rag.green : rag.complete;
                return (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <RagPill rag={key} />
                    <span className="font-semibold tabular-nums">{count}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * A variance, with its sign explained in words.
 *
 * "−12%" is ambiguous until you know which direction is bad, so the caption
 * says it rather than relying on the reader to remember the convention.
 */
function VarianceCard({
  label,
  value,
  positiveHint,
  negativeHint,
  explanation,
}: {
  label: string;
  value: number | null;
  positiveHint: string;
  negativeHint: string;
  explanation: string;
}) {
  const ahead = (value ?? 0) >= 0;
  const Icon = ahead ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {value === null ? (
          <>
            <p className="text-2xl font-bold text-muted-foreground">N/A</p>
            <p className="text-xs text-muted-foreground">
              Not enough data in this selection to calculate it.
            </p>
          </>
        ) : (
          <>
            <p
              className={cn(
                'flex items-center gap-2 text-2xl font-bold tabular-nums',
                ahead ? 'text-success-strong' : 'text-destructive',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {ahead ? '+' : '−'}
              {Math.abs(Math.round(value))} pts
            </p>
            <p className="text-xs text-muted-foreground">{ahead ? positiveHint : negativeHint}</p>
          </>
        )}
        <p className="pt-1 text-xs text-muted-foreground">{explanation}</p>
      </CardContent>
    </Card>
  );
}
