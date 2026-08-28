'use client';

import * as React from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowRight, Building, CalendarDays, Crown, Library, UserCircle, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataToolbar, ALL } from '@/components/ui/data-toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { DecisionPill, TaskStatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProjectRiskPanel } from './project-summary';
import { assessRag, committedSpend, displayProgress } from '@/lib/metrics';
import { daysUntil } from '@/lib/ui/health';
import { TASK_SORT_OPTIONS, sortTasks, type TaskSort } from '@/lib/ui/sort';
import { cn } from '@/lib/utils';

/**
 * The sections of a project that are not milestones, issues or documents.
 *
 * Split out of project-view.tsx so that file stays a layout rather than
 * becoming eight screens in a trench coat. Each of these owns its own filter
 * state, and none of them should re-render the others.
 */

const money = (amount: unknown, currency?: string | null) => {
  const symbol = currency === 'USD' ? '$' : 'ETB';
  const value = Number(String(amount ?? 0)) || 0;
  return `${symbol} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** What the project is, who owns it, and what is wrong with it. */
export function ProjectOverviewTab({
  project,
  onNavigate,
}: {
  project: any;
  onNavigate: (tab: string) => void;
}) {
  const departments = (project.responsibleDepartments ?? []).map((d: any) => d.name);
  const participatingDivisions = (project.participatingDivisions ?? []).map((d: any) => d.name);

  return (
    <div className="space-y-6">
      <ProjectRiskPanel project={project} onNavigate={onNavigate} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About this project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {project.description || 'No description was recorded.'}
          </p>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact icon={UserCircle} label="Project manager">
              {project.projectManager?.name ?? 'Unassigned'}
            </Fact>
            <Fact icon={Library} label="Owning EPMO division">
              {project.pmoDivision?.name ?? 'None'}
            </Fact>
            <Fact icon={Library} label="Participating divisions">
              {participatingDivisions.length > 0
                ? participatingDivisions.join(', ')
                : 'Owned solely by the division above'}
            </Fact>
            <Fact icon={Building} label="Delivered for">
              {departments.length > 0 ? departments.join(', ') : 'Nobody recorded'}
            </Fact>
            <Fact icon={CalendarDays} label="Runs">
              {format(parseISO(project.startDate), 'd MMM yyyy')} –{' '}
              {format(parseISO(project.endDate), 'd MMM yyyy')}
            </Fact>
            <Fact icon={CalendarDays} label="Working year">
              {project.workingYear ?? '—'}
            </Fact>
            <Fact icon={CalendarDays} label="Originally committed to">
              {project.baselineEndDate
                ? format(parseISO(project.baselineEndDate), 'd MMM yyyy')
                : 'No baseline captured'}
            </Fact>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

/**
 * Every task in the project, flat.
 *
 * Flat is the point. Tasks were previously reachable only by expanding the
 * milestone that happened to hold them, so "what is overdue on this project"
 * meant opening every milestone in turn and reading dates.
 */
export function ProjectTasksTab({ project }: { project: any }) {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState(ALL);
  const [milestone, setMilestone] = React.useState(ALL);
  const [sort, setSort] = React.useState<TaskSort>('due');

  const tasks = React.useMemo(
    () =>
      (project.milestones ?? []).flatMap((m: any) =>
        (m.tasks ?? []).map((t: any) => ({ ...t, milestoneTitle: m.title, milestoneId: m.id })),
      ),
    [project.milestones],
  );

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = tasks.filter((task: any) => {
      if (status !== ALL && task.status !== status) return false;
      if (milestone !== ALL && task.milestoneId !== milestone) return false;
      if (!query) return true;
      return (
        String(task.title ?? '').toLowerCase().includes(query) ||
        (task.assignees ?? []).some((a: any) =>
          String(a.name ?? '').toLowerCase().includes(query),
        )
      );
    });
    return sortTasks(filtered, sort);
  }, [tasks, search, status, milestone, sort]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardDescription>
          Every task across every milestone, so the whole project can be searched at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            description="Tasks appear here once they are added to a milestone."
            compact
          />
        ) : (
          <>
            <DataToolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search tasks or people…',
                label: 'Search tasks in this project',
              }}
              filters={[
                {
                  id: 'status',
                  label: 'Status',
                  value: status,
                  onChange: setStatus,
                  options: [
                    { value: 'TODO', label: 'To do' },
                    { value: 'IN_PROGRESS', label: 'In progress' },
                    { value: 'PENDING_REVIEW', label: 'Awaiting review' },
                    { value: 'DONE', label: 'Done' },
                  ],
                  allLabel: 'Any status',
                },
                {
                  id: 'milestone',
                  label: 'Milestone',
                  value: milestone,
                  onChange: setMilestone,
                  options: (project.milestones ?? []).map((m: any) => ({
                    value: m.id,
                    label: m.title,
                  })),
                  allLabel: 'All milestones',
                },
              ]}
              sort={{
                value: sort,
                onChange: (v) => setSort(v as TaskSort),
                options: TASK_SORT_OPTIONS,
              }}
              count={{ showing: visible.length, total: tasks.length, noun: 'tasks' }}
              onClearAll={() => {
                setSearch('');
                setStatus(ALL);
                setMilestone(ALL);
              }}
            />

            {visible.length === 0 ? (
              <EmptyState
                variant="no-match"
                title="No tasks match"
                description="This project has tasks — none of them fit the filters you have set."
                compact
              />
            ) : (
              <Table scrollLabel="Tasks in this project">
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignees</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((task: any) => {
                    const remaining = daysUntil({ endDate: task.endDate });
                    const overdue =
                      remaining !== null && remaining < 0 && task.status !== 'DONE';

                    return (
                      <TableRow key={task.id}>
                        <TableCell className="max-w-[240px] font-medium">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="block truncate rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {task.title}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-muted-foreground">
                          {task.milestoneTitle}
                        </TableCell>
                        <TableCell>
                          <TaskStatusPill status={task.status} />
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {(task.assignees ?? []).map((a: any) => a.name).join(', ') || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={task.progress || 0} className="h-2 w-14" />
                            <span className="tabular-nums">{task.progress || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(task.endDate), 'd MMM yyyy')}
                          {/* Overdue is said in words as well as colour. */}
                          {overdue && (
                            <span className="block text-xs font-medium text-destructive">
                              {Math.abs(remaining!)} days overdue
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Who is on this project, and what they are carrying. */
export function ProjectTeamTab({ project }: { project: any }) {
  const teams = (project.teamLinks ?? []).map((link: any) => link.team).filter(Boolean);

  const assignmentCount = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const milestone of project.milestones ?? []) {
      for (const task of milestone.tasks ?? []) {
        for (const assignee of task.assignees ?? []) {
          counts.set(assignee.id, (counts.get(assignee.id) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [project.milestones]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>
          The teams delivering this project, and how much of its work each person holds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <Crown className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm text-muted-foreground">Project manager</p>
            <p className="font-medium">{project.projectManager?.name ?? 'Unassigned'}</p>
          </div>
        </div>

        {teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team assigned"
            description="Nobody is formally on this project yet. Tasks can still be assigned to individuals."
            compact
          />
        ) : (
          <ul className="space-y-4">
            {teams.map((team: any) => (
              <li key={team.id} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{team.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Led by {team.teamLead?.name ?? 'nobody'}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {(team.members ?? []).length} member
                    {(team.members ?? []).length === 1 ? '' : 's'}
                  </Badge>
                </div>

                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(team.members ?? []).map((member: any) => {
                    const load = assignmentCount.get(member.id) ?? 0;
                    return (
                      <li key={member.id} className="flex items-center gap-2 rounded-md border p-2">
                        <Avatar className="h-8 w-8 shrink-0 border">
                          <AvatarImage src={member.avatar ?? undefined} alt="" />
                          <AvatarFallback>{member.name?.charAt(0) ?? '?'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {load === 0
                              ? 'No tasks on this project'
                              : `${load} task${load === 1 ? '' : 's'} here`}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** What the project costs and what has actually been released. */
export function ProjectBudgetTab({ project }: { project: any }) {
  const payments = project.payments ?? [];
  const currency = project.currency;
  const budget = Number(String(project.totalCost ?? 0)) || 0;
  const rag = assessRag(project);
  const committed = committedSpend(project);
  const pending = payments
    .filter((p: any) => p.status === 'PENDING')
    .reduce((sum: number, p: any) => sum + (Number(String(p.amount ?? 0)) || 0), 0);

  if (budget <= 0 && payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No budget recorded"
            description="This project was registered without a cost, so there is nothing to track. Add one by editing the project."
            compact
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Budget</CardTitle>
          <CardDescription>
            Committed spend counts approved payments only — what is contractually owed, not what
            has been proposed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Figure label="Total budget" value={money(budget, currency)} />
            <Figure
              label="Committed"
              value={money(committed, currency)}
              hint={rag.budgetUsed !== null ? `${Math.round(rag.budgetUsed)}% of budget` : undefined}
            />
            <Figure
              label="Awaiting approval"
              value={money(pending, currency)}
              hint={pending > 0 ? 'not yet released' : 'nothing pending'}
            />
          </div>

          {budget > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget used against delivery</span>
                <span className="font-medium tabular-nums">
                  {Math.round(rag.budgetUsed ?? 0)}% spent · {displayProgress(rag.progress)}%
                  delivered
                </span>
              </div>
              <Progress
                value={Math.min(100, rag.budgetUsed ?? 0)}
                className="h-2"
                aria-label={`Budget used: ${Math.round(rag.budgetUsed ?? 0)} percent`}
              />
              {rag.budgetVariance !== null && (
                <p
                  className={cn(
                    'text-xs font-medium',
                    rag.budgetVariance >= 0 ? 'text-success-strong' : 'text-destructive',
                  )}
                >
                  {rag.budgetVariance >= 0
                    ? `Delivery is ${Math.round(rag.budgetVariance)} points ahead of spend.`
                    : `Spend is ${Math.abs(Math.round(rag.budgetVariance))} points ahead of delivery.`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState
              title="No payments scheduled"
              description="The project has a budget but no payment schedule against it."
              compact
            />
          ) : (
            <Table scrollLabel="Payment schedule">
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.title}
                      {payment.description && (
                        <span className="block text-xs text-muted-foreground">
                          {payment.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(payment.paymentDate), 'd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <DecisionPill status={payment.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                      {money(payment.amount, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Scheduled in total</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {money(
                      payments.reduce(
                        (sum: number, p: any) => sum + (Number(String(p.amount ?? 0)) || 0),
                        0,
                      ),
                      currency,
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * What has happened on this project lately.
 *
 * Assembled from task updates and timeline decisions, newest first. There is
 * no per-project audit stream, so this is built from the records that do carry
 * timestamps rather than from an invented one.
 */
export function ProjectActivityTab({ project }: { project: any }) {
  const events = React.useMemo(() => {
    const out: {
      id: string;
      at: string;
      kind: string;
      title: string;
      detail: string | null;
      href?: string;
    }[] = [];

    for (const milestone of project.milestones ?? []) {
      for (const task of milestone.tasks ?? []) {
        for (const update of task.updates ?? []) {
          out.push({
            id: `update-${update.id}`,
            at: update.createdAt,
            kind: update.type === 'STATUS_CHANGE' ? 'Review decision' : 'Progress update',
            title: task.title,
            detail: update.text,
            href: `/tasks/${task.id}`,
          });
        }
      }
    }

    for (const request of project.timelineChangeRequests ?? []) {
      out.push({
        id: `timeline-${request.id}`,
        at: request.createdAt,
        kind: 'Deadline change requested',
        title: `${format(parseISO(request.oldEndDate), 'd MMM yy')} → ${format(parseISO(request.newEndDate), 'd MMM yy')}`,
        detail: request.reason,
      });
    }

    return out
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 100);
  }, [project]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>
          Progress updates and deadline decisions on this project, most recent first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            title="Nothing has happened yet"
            description="Progress updates and review decisions will appear here as work moves."
            compact
          />
        ) : (
          <ol className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3 border-l-2 pl-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      {event.href ? (
                        <Link
                          href={event.href}
                          className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {event.title}
                        </Link>
                      ) : (
                        event.title
                      )}
                    </p>
                    <time
                      dateTime={new Date(event.at).toISOString()}
                      className="text-xs text-muted-foreground"
                    >
                      {formatDistanceToNow(new Date(event.at), { addSuffix: true })}
                    </time>
                  </div>
                  <p className="text-xs text-muted-foreground">{event.kind}</p>
                  {event.detail && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {event.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
