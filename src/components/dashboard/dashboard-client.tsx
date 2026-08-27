"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle,
  Clock,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { format, parseISO, max as dateMax } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataToolbar, ALL } from "@/components/ui/data-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { RISK_CLASS, RISK_ICON } from "@/components/ui/status-pill";
import { Separator } from "../ui/separator";
import { useAuth } from "@/context/auth-context";
import { CelebrationSlider } from "./celebration-slider";
import { DepartmentProjectsChart } from "@/components/dashboard/department-projects-chart";
import { ProjectStatusChart } from "@/components/dashboard/project-status-chart";
import { ResponsibleDepartmentChart } from "@/components/dashboard/responsible-department-chart";
import { isOpenBlocker } from "@/lib/validation/blocker";
import {
  displayProgress,
  projectProgress as calculateProjectProgress,
  isArchivedStatus,
  isClosedStatus,
  isOverdue,
  summarizeRag,
  summarizeSchedule,
} from "@/lib/metrics";
import { projectRisks } from "@/lib/ui/health";
import { sortProjects } from "@/lib/ui/sort";
import {
  ProjectTable,
  PROJECT_COLUMNS,
  DEFAULT_PROJECT_COLUMNS,
  sortProjectRows,
  type ProjectColumn,
  type ProjectTableSort,
} from "@/components/projects/project-table";
import { ColumnPicker } from "@/components/ui/column-picker";
import { PortfolioHealth, NeedsAttention } from "./portfolio-health";
import { useTablePreferences } from "@/hooks/use-table-preferences";
import { getAttentionCounts } from "@/app/approvals/actions";
import { cn } from "@/lib/utils";

/**
 * The portfolio at a glance.
 *
 * What this screen used to open with was a full-width card headed "Welcome to
 * NIB EPMO" carrying four lines of marketing copy — the most valuable space on
 * the most-visited page in the system, spent on something nobody reads twice.
 * Below it, four KPI cards, then an accordion of every active project nested
 * three levels deep (project → milestone → task) which had to be opened one
 * node at a time to find anything.
 *
 * The figures themselves were fine — they come from `@/lib/metrics`, which is
 * the single definition — but they answered "how did the portfolio do" and
 * never "what should I do about it". The attention panel is the missing half:
 * the projects that need somebody, worst first, each with a route to the thing
 * that is wrong.
 */
export function DashboardClient({
  initialProjects,
  projectStatuses,
  pmoDivisions,
  departments,
  teams,
  availableYears,
  currentWorkingYear,
  deliveryTrend = [],
}: any) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();

  const selectedYear = searchParams.get("year") || currentWorkingYear;
  const selectedDivision = searchParams.get("division") || ALL;

  /**
   * The project table's layout, remembered for this person.
   *
   * Sort lives here too rather than in the URL: which column somebody sorts by
   * is a working preference, not a description of the data, and putting it in
   * the address bar would make every shared dashboard link carry one reader's
   * habits.
   */
  const [tablePrefs, setTablePrefs] = useTablePreferences<{
    columns: string[];
    sort: ProjectTableSort;
  }>('dashboard-projects', {
    columns: DEFAULT_PROJECT_COLUMNS,
    // Worst health first: this table exists to surface trouble, so the default
    // ordering should already have done that before anyone touches a header.
    sort: { column: 'rag', direction: 'asc' },
  });
  const columns = tablePrefs.columns as ProjectColumn[];
  const tableSort = tablePrefs.sort as ProjectTableSort;
  const setColumns = (next: ProjectColumn[]) => setTablePrefs({ columns: next });
  const setTableSort = (next: ProjectTableSort) => setTablePrefs({ sort: next });

  /** What is outstanding for this person, counted on the server. */
  const [attentionCounts, setAttentionCounts] = React.useState<{
    pendingApprovals: number;
    overdueTasks: number;
    openBlockers: number;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getAttentionCounts()
      .then((counts) => {
        if (!cancelled) setAttentionCounts(counts);
      })
      // The panel simply does not render if the counts cannot be fetched —
      // the rest of the dashboard is still worth showing.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const ready =
    initialProjects && projectStatuses && pmoDivisions && departments && teams;

  const { filteredProjects, activeProjects, recentlyCompletedProjects } =
    React.useMemo(() => {
      if (!ready) {
        return { filteredProjects: [], activeProjects: [], recentlyCompletedProjects: [] };
      }

      // The year and division filters already ran in the query; what is left
      // here is splitting the result into the live portfolio and what has
      // just landed.
      const tempProjects = initialProjects;

      // Category, not name: statuses are renameable, categories are not.
      const archivedStatusIds = new Set(
        projectStatuses.filter((s: any) => isArchivedStatus(s)).map((s: any) => s.id),
      );
      const closedStatusIds = new Set(
        projectStatuses.filter((s: any) => isClosedStatus(s)).map((s: any) => s.id),
      );

      const activeProjs = tempProjects.filter(
        (p: any) => !archivedStatusIds.has(p.statusId),
      );

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const recentCompleted = tempProjects.filter((p: any) => {
        if (!closedStatusIds.has(p.statusId)) return false;

        const completions = p.milestones
          .flatMap((m: any) => m.tasks.map((t: any) => t.completedAt))
          .filter(Boolean);
        if (completions.length === 0) return false;

        const lastCompletionDate = dateMax(completions.map((d: any) => parseISO(d)));
        return lastCompletionDate >= threeDaysAgo;
      });

      return {
        filteredProjects: tempProjects,
        activeProjects: activeProjs,
        recentlyCompletedProjects: recentCompleted,
      };
    }, [ready, initialProjects, projectStatuses]);

  const { stats, projectsWithBlockers } = React.useMemo(() => {
    // Every figure below comes from @/lib/metrics, so this card and the report
    // it links to cannot disagree. The previous local arithmetic compared
    // planned task dates rather than actual completion, and used a different
    // day boundary from the CEO report.
    const schedule = summarizeSchedule(filteredProjects);

    const projectsWithOpenBlockers = filteredProjects.filter((p: any) =>
      p.blockers?.some((b: any) => isOpenBlocker(b.status)),
    );

    const totalBlockersCount = projectsWithOpenBlockers.reduce(
      (acc: number, p: any) => acc + (p.blockers?.length || 0),
      0,
    );

    return {
      stats: {
        onTimeProjectsCount: schedule.onTime,
        lateProjectsCount: schedule.late,
        overdueProjectsCount: filteredProjects.filter((p: any) => isOverdue(p)).length,
        totalBlockersCount,
      },
      projectsWithBlockers: projectsWithOpenBlockers,
    };
  }, [filteredProjects]);

  /**
   * The live projects with something wrong, worst first.
   *
   * Capped rather than exhaustive: this is a triage list, and one that runs to
   * forty entries is another thing to scroll past. The count says how many
   * were left off so the cap is never mistaken for the total.
   */
  const attention = React.useMemo(() => {
    const flagged = activeProjects
      .map((project: any) => ({ project, risks: projectRisks(project) }))
      .filter((entry: any) => entry.risks.length > 0);

    const ordered = sortProjects(
      flagged.map((e: any) => e.project),
      "risk",
    );

    return {
      items: ordered.slice(0, 6).map((project: any) => ({
        project,
        risks: flagged.find((e: any) => e.project.id === project.id)!.risks,
      })),
      total: flagged.length,
    };
  }, [activeProjects]);

  /** The RAG spread across whatever the filters currently select. */
  const portfolioRag = React.useMemo(
    () => summarizeRag(filteredProjects),
    [filteredProjects],
  );

  /** Every filter the cards were counted under, so a drill-down matches. */
  const reportQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("year", selectedYear);
    if (selectedDivision !== ALL) params.set("division", selectedDivision);
    return params.toString();
  }, [selectedYear, selectedDivision]);

  const activeBlockersHref = React.useMemo(() => {
    if (projectsWithBlockers.length === 1) {
      return `/projects/${projectsWithBlockers[0].id}?tab=blockers`;
    }
    return `/reports?type=active-blockers&${reportQuery}`;
  }, [projectsWithBlockers, reportQuery]);

  const handleQueryChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== ALL && value !== currentWorkingYear) {
      params.set(key, value);
    } else {
      params.delete(key);
      if (value === ALL) {
        params.set(key, ALL);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  if (!ready) {
    return (
      <PageShell>
        <PageHeader title="Portfolio dashboard" description="Loading the portfolio…" />
      </PageShell>
    );
  }

  const divisionName =
    selectedDivision === ALL
      ? "all EPMO divisions"
      : (pmoDivisions.find((d: any) => d.id === selectedDivision)?.name ?? "one division");

  return (
    <PageShell>
      {recentlyCompletedProjects.length > 0 && (
        <CelebrationSlider completedProjects={recentlyCompletedProjects} teams={teams} />
      )}

      <PageHeader
        title="Portfolio dashboard"
        description={`${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"} across ${divisionName} in ${selectedYear === ALL ? "every working year" : selectedYear}.`}
      >
        <DataToolbar
          filters={[
            {
              id: "year",
              label: "Working year",
              value: selectedYear,
              onChange: (v) => handleQueryChange("year", v),
              options: availableYears
                .filter((y: string) => y !== ALL)
                .map((y: string) => ({ value: y, label: y })),
              allLabel: "All years",
            },
            {
              id: "division",
              label: "EPMO division",
              value: selectedDivision,
              onChange: (v) => handleQueryChange("division", v),
              options: pmoDivisions.map((d: any) => ({ value: d.id, label: d.name })),
              allLabel: "All EPMO divisions",
            },
          ]}
        />
      </PageHeader>

      {/*
        Health first, then what needs doing, then the numbers.
        The order is the order somebody reads them in: is the portfolio all
        right, is anything waiting on me, and only then how did we do.
      */}
      <PortfolioHealth
        rag={portfolioRag}
        deliveryTrend={deliveryTrend}
        onDrillDown={(rating) =>
          router.push(
            `/reports?type=${rating === 'RED' ? 'overdue' : 'at-risk'}&${reportQuery}`,
          )
        }
      />

      {attentionCounts && (
        <NeedsAttention
          pendingApprovals={attentionCounts.pendingApprovals}
          overdueTasks={attentionCounts.overdueTasks}
          openBlockers={attentionCounts.openBlockers}
        />
      )}

      <StatCardGrid>
        <StatCard
          label="On-time completion"
          metric="onTime"
          icon={CheckCircle}
          tone="positive"
          value={stats.onTimeProjectsCount}
          hint="completed on or before the committed deadline"
          href={`/reports?type=on-time&${reportQuery}`}
          interactive={stats.onTimeProjectsCount > 0}
        />
        <StatCard
          label="Late completion"
          metric="late"
          icon={Clock}
          tone={stats.lateProjectsCount > 0 ? "warning" : "neutral"}
          value={stats.lateProjectsCount}
          hint="completed after the committed deadline"
          href={`/reports?type=late&${reportQuery}`}
          interactive={stats.lateProjectsCount > 0}
        />
        <StatCard
          label="Overdue projects"
          metric="overdue"
          icon={AlertOctagon}
          tone={stats.overdueProjectsCount > 0 ? "critical" : "positive"}
          value={stats.overdueProjectsCount}
          hint="still running, past their deadline"
          href={`/reports?type=overdue&${reportQuery}`}
          interactive={stats.overdueProjectsCount > 0}
        />
        <StatCard
          label="Active blockers"
          metric="blockers"
          icon={ShieldAlert}
          tone={stats.totalBlockersCount > 0 ? "critical" : "positive"}
          value={stats.totalBlockersCount}
          // The headline counts blockers; the report behind it lists the
          // projects holding them. Naming both makes the two figures reconcile
          // instead of looking like a contradiction.
          hint={`across ${projectsWithBlockers.length} project${projectsWithBlockers.length === 1 ? "" : "s"}`}
          href={activeBlockersHref}
          interactive={stats.totalBlockersCount > 0}
        />
      </StatCardGrid>

      <AttentionPanel
        items={attention.items}
        total={attention.total}
        activeCount={activeProjects.length}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Active projects</CardTitle>
              <CardDescription>
                Everything currently in delivery. Sort by any column to find what needs you.
              </CardDescription>
            </div>
            <ColumnPicker
              columns={PROJECT_COLUMNS}
              selected={columns}
              onChange={setColumns}
            />
          </div>
        </CardHeader>
        <CardContent>
          {activeProjects.length > 0 ? (
            <ProjectTable
              projects={sortProjectRows(activeProjects, tableSort)}
              columns={columns}
              sort={tableSort}
              onSortChange={setTableSort}
              // The dashboard's filters travel with the link, so returning
              // from a project lands on the same slice of the portfolio the
              // reader left. Without this, every drill-down reset the view.
              linkQuery={reportQuery}
            />
          ) : (
            <EmptyState
              variant={filteredProjects.length > 0 ? "no-match" : "empty"}
              title={
                filteredProjects.length > 0
                  ? "Nothing is in delivery right now"
                  : "No projects in this selection"
              }
              description={
                filteredProjects.length > 0
                  ? `All ${filteredProjects.length} project${filteredProjects.length === 1 ? " is" : "s are"} completed or handed over.`
                  : "Try a different working year or EPMO division."
              }
              compact
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by owning EPMO division</CardTitle>
            <CardDescription>Where the portfolio sits.</CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentProjectsChart projects={filteredProjects} pmoDivisions={pmoDivisions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by status</CardTitle>
            <CardDescription>How delivery is going across the board.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectStatusChart projects={filteredProjects} projectStatuses={projectStatuses} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by responsible department</CardTitle>
            <CardDescription>Who the work is being delivered for.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsibleDepartmentChart projects={filteredProjects} departments={departments} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">EPMO divisions</CardTitle>
            <CardDescription>
              Who to call about each one.
              {hasPermission("pmo-divisions:view") && (
                <>
                  {" "}
                  Manage them on the{" "}
                  <Link href="/pmo-divisions" className="text-primary hover:underline">
                    EPMO divisions page
                  </Link>
                  .
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pmoDivisions.length > 0 ? (
              <ul className="space-y-2">
                {pmoDivisions.map((division: any, index: number) => (
                  <li key={division.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2 rounded-md p-2 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="font-semibold">{division.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {division.responsibleName}, {division.responsibleTitle}
                        </p>
                      </div>
                      {division.responsiblePhone && (
                        <a
                          href={`tel:${division.responsiblePhone}`}
                          className="inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Phone className="h-4 w-4" aria-hidden="true" />
                          {division.responsiblePhone}
                        </a>
                      )}
                    </div>
                    {index < pmoDivisions.length - 1 && <Separator className="mt-2" />}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No EPMO divisions yet" compact />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project teams</CardTitle>
            <CardDescription>
              Who is delivering the work in this selection.
              {hasPermission("teams:read") && (
                <>
                  {" "}
                  Manage them on the{" "}
                  <Link href="/teams" className="text-primary hover:underline">
                    Teams page
                  </Link>
                  .
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/*
              The teams query is already scoped to the filtered projects on the
              server. The client used to filter it again on `team.projectId` — a
              column that no longer exists now a team can serve several
              projects — so this card was permanently empty.
            */}
            {teams.length > 0 ? (
              <ul className="space-y-2">
                {teams.map((team: any, index: number) => (
                  <li key={team.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2 rounded-md p-2 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="font-semibold">{team.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Led by {team.teamLead?.name ?? "nobody"}
                          {team.members?.length
                            ? ` · ${team.members.length} member${team.members.length === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(team.projects ?? []).slice(0, 2).map((link: any) => (
                          <Badge key={link.project.id} variant="outline" className="max-w-[18ch] truncate">
                            {link.project.name}
                          </Badge>
                        ))}
                        {(team.projects?.length ?? 0) > 2 && (
                          <Badge variant="outline">+{team.projects.length - 2}</Badge>
                        )}
                      </div>
                    </div>
                    {index < teams.length - 1 && <Separator className="mt-2" />}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No teams on these projects"
                description="Teams are created against a project and appear here once one is."
                compact
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

/**
 * What needs somebody, and where to go about it.
 *
 * The whole reason this screen exists. The KPI cards report the past; this
 * reports the present, and every entry is a link into the thing that is wrong
 * rather than a number to be interpreted.
 */
function AttentionPanel({
  items,
  total,
  activeCount,
}: {
  items: { project: any; risks: ReturnType<typeof projectRisks> }[];
  total: number;
  activeCount: number;
}) {
  if (activeCount === 0) return null;

  if (items.length === 0) {
    return (
      <Card className="border-green-700/30 bg-green-700/5">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
          <div>
            <p className="font-medium text-green-900">Nothing needs attention</p>
            <p className="text-sm text-muted-foreground">
              All {activeCount} active project{activeCount === 1 ? "" : "s"} are on schedule with no
              open issues.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>
          {total} of {activeCount} active project{activeCount === 1 ? "" : "s"} have something
          working against them, worst first.
          {total > items.length && ` Showing the ${items.length} most serious.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(({ project, risks }) => {
          const worst = risks[0];
          const Icon = RISK_ICON[worst.severity];
          const progress = calculateProjectProgress(project);

          return (
            <div
              key={project.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="rounded-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {project.name}
                  </Link>
                  <Badge variant="secondary" className="font-normal">
                    {project.status?.name}
                  </Badge>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {risks.slice(0, 3).map((risk) => {
                    const RiskIcon = RISK_ICON[risk.severity];
                    return (
                      <li key={risk.id}>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                            RISK_CLASS[risk.severity],
                          )}
                          title={risk.detail}
                        >
                          <RiskIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {risk.label}
                        </span>
                      </li>
                    );
                  })}
                  {risks.length > 3 && (
                    <li className="self-center text-xs text-muted-foreground">
                      +{risks.length - 3} more
                    </li>
                  )}
                </ul>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {worst.detail}
                </p>
              </div>

              <div className="flex items-center gap-3 sm:shrink-0">
                <div className="w-28">
                  <Progress
                    value={progress}
                    className="h-2"
                    aria-label={`${project.name}: ${displayProgress(progress)}% complete`}
                  />
                  <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                    {displayProgress(progress)}%
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={
                      worst.section
                        ? `/projects/${project.id}?tab=${worst.section}`
                        : `/projects/${project.id}`
                    }
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
