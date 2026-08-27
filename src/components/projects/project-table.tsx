'use client';

import * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RagPill } from '@/components/ui/status-pill';
import {
  Table,
  TableCard,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { assessRag, displayProgress, projectProgress } from '@/lib/metrics';
import { cn } from '@/lib/utils';

/**
 * The portfolio as a table you can actually scan.
 *
 * What this replaces on the dashboard was an accordion nested three deep —
 * project, then milestone, then a table of tasks — which meant three clicks to
 * see anything and no way to compare two projects at all, because only one
 * could be open at a time. A table is the right shape for "which of these
 * forty needs me": every row shows the same facts in the same column, and the
 * column you care about is the one you sort by.
 *
 * Sorting is client-side here because the dashboard already holds the whole
 * filtered set in memory — it has to, to compute the RAG spread. The projects
 * *list* pages, which are server-paged, sort in the query instead; sorting one
 * page of nine and calling it an ordering would be a lie.
 */

export type ProjectColumn =
  | 'name'
  | 'rag'
  | 'status'
  | 'manager'
  | 'progress'
  | 'schedule'
  | 'budget'
  | 'deadline'
  | 'issues';

export interface ProjectColumnDef {
  id: ProjectColumn;
  label: string;
  /** Right-aligned for numbers, so decimal points line up down the column. */
  numeric?: boolean;
  /** Columns a reader cannot turn off, because the row would stop making sense. */
  required?: boolean;
}

export const PROJECT_COLUMNS: ProjectColumnDef[] = [
  { id: 'name', label: 'Project', required: true },
  { id: 'rag', label: 'Health', required: true },
  { id: 'status', label: 'Status' },
  { id: 'manager', label: 'Manager' },
  { id: 'progress', label: 'Progress', numeric: true },
  { id: 'schedule', label: 'Schedule variance', numeric: true },
  { id: 'budget', label: 'Budget used', numeric: true },
  { id: 'deadline', label: 'Deadline' },
  { id: 'issues', label: 'Open issues', numeric: true },
];

export const DEFAULT_PROJECT_COLUMNS: ProjectColumn[] = [
  'name',
  'rag',
  'status',
  'progress',
  'schedule',
  'deadline',
  'issues',
];

export type SortDirection = 'asc' | 'desc';

export interface ProjectTableSort {
  column: ProjectColumn;
  direction: SortDirection;
}

const RAG_RANK: Record<string, number> = { RED: 0, AMBER: 1, GREEN: 2, COMPLETE: 3 };

const openIssueCount = (project: any) =>
  (project.blockers ?? []).filter((b: any) =>
    ['OPEN', 'IN_PROGRESS', 'ESCALATED'].includes(String(b.status ?? '')),
  ).length;

const time = (value: unknown) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = new Date(value as string).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

/** Orders rows without mutating the input. Ties always break on name. */
export function sortProjectRows(projects: any[], sort: ProjectTableSort): any[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const byName = (a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''));

  return [...projects].sort((a, b) => {
    let result = 0;
    switch (sort.column) {
      case 'rag': {
        result = RAG_RANK[assessRag(a).rag] - RAG_RANK[assessRag(b).rag];
        break;
      }
      case 'status':
        result = String(a.status?.name ?? '').localeCompare(String(b.status?.name ?? ''));
        break;
      case 'manager':
        result = String(a.projectManager?.name ?? '').localeCompare(
          String(b.projectManager?.name ?? ''),
        );
        break;
      case 'progress':
        result = projectProgress(a) - projectProgress(b);
        break;
      case 'schedule':
        result = (assessRag(a).scheduleVariance ?? 0) - (assessRag(b).scheduleVariance ?? 0);
        break;
      case 'budget':
        result = (assessRag(a).budgetUsed ?? -1) - (assessRag(b).budgetUsed ?? -1);
        break;
      case 'deadline':
        result = time(a.endDate) - time(b.endDate);
        break;
      case 'issues':
        result = openIssueCount(a) - openIssueCount(b);
        break;
      case 'name':
      default:
        result = byName(a, b);
    }
    return result * sign || byName(a, b);
  });
}

export interface ProjectTableProps {
  projects: any[];
  columns: ProjectColumn[];
  sort: ProjectTableSort;
  onSortChange: (sort: ProjectTableSort) => void;
  /** Appended to each project link, so filters survive the round trip. */
  linkQuery?: string;
  className?: string;
}

export function ProjectTable({
  projects,
  columns,
  sort,
  onSortChange,
  linkQuery,
  className,
}: ProjectTableProps) {
  const shown = PROJECT_COLUMNS.filter((c) => columns.includes(c.id));

  const toggleSort = (column: ProjectColumn) => {
    if (sort.column === column) {
      onSortChange({ column, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      // A new column starts in the direction that puts the interesting end
      // first: worst health, least progress, soonest deadline, most issues.
      const descendingFirst: ProjectColumn[] = ['issues', 'budget'];
      onSortChange({ column, direction: descendingFirst.includes(column) ? 'desc' : 'asc' });
    }
  };

  return (
    <TableCard>
      <Table scrollLabel="Projects" className={className}>
        <TableHeader>
          <TableRow>
            {shown.map((column) => {
              const active = sort.column === column.id;
              const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
              return (
                <TableHead
                  key={column.id}
                  className={cn(column.numeric && 'text-right')}
                  // Announces the current ordering, which colour and a chevron
                  // alone do not.
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-sm font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      column.numeric && 'flex-row-reverse',
                      active && 'text-foreground',
                    )}
                  >
                    {column.label}
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    <span className="sr-only">
                      {active
                        ? `sorted ${sort.direction === 'asc' ? 'ascending' : 'descending'}, activate to reverse`
                        : 'activate to sort'}
                    </span>
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const rag = assessRag(project);
            const progress = projectProgress(project);
            const issues = openIssueCount(project);
            const href = `/projects/${project.id}${linkQuery ? `?${linkQuery}` : ''}`;

            return (
              <TableRow key={project.id}>
                {shown.map((column) => {
                  switch (column.id) {
                    case 'name':
                      return (
                        <TableCell key={column.id} className="max-w-[280px] font-medium">
                          <Link
                            href={href}
                            className="block truncate rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title={project.name}
                          >
                            {project.name}
                          </Link>
                          {rag.reasons.length > 0 && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {rag.reasons[0]}
                            </span>
                          )}
                        </TableCell>
                      );
                    case 'rag':
                      return (
                        <TableCell key={column.id}>
                          <RagPill rag={rag.rag} />
                        </TableCell>
                      );
                    case 'status':
                      return (
                        <TableCell key={column.id}>
                          <Badge variant="secondary" className="font-normal">
                            {project.status?.name ?? 'Unknown'}
                          </Badge>
                        </TableCell>
                      );
                    case 'manager':
                      return (
                        <TableCell key={column.id} className="max-w-[160px] truncate">
                          {project.projectManager?.name ?? '—'}
                        </TableCell>
                      );
                    case 'progress':
                      return (
                        <TableCell key={column.id}>
                          <div className="flex items-center justify-end gap-2">
                            <Progress
                              value={progress}
                              className="h-2 w-16"
                              aria-label={`${project.name}: ${displayProgress(progress)}% complete`}
                            />
                            <span className="w-9 text-right tabular-nums">
                              {displayProgress(progress)}%
                            </span>
                          </div>
                        </TableCell>
                      );
                    case 'schedule':
                      return (
                        <TableCell key={column.id} className="text-right tabular-nums">
                          <VarianceCell value={rag.scheduleVariance} />
                        </TableCell>
                      );
                    case 'budget':
                      return (
                        <TableCell key={column.id} className="text-right tabular-nums">
                          {rag.budgetUsed === null ? (
                            <span className="text-muted-foreground">No budget</span>
                          ) : (
                            `${Math.round(rag.budgetUsed)}%`
                          )}
                        </TableCell>
                      );
                    case 'deadline':
                      return (
                        <TableCell key={column.id} className="whitespace-nowrap">
                          {project.endDate ? format(parseISO(project.endDate), 'd MMM yyyy') : '—'}
                          {rag.daysRemaining !== null && rag.daysRemaining < 0 && (
                            <span className="block text-xs text-destructive">
                              {Math.abs(rag.daysRemaining)} days over
                            </span>
                          )}
                        </TableCell>
                      );
                    case 'issues':
                      return (
                        <TableCell key={column.id} className="text-right tabular-nums">
                          {issues > 0 ? (
                            <span className="font-medium text-destructive">{issues}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      );
                    default:
                      return <TableCell key={column.id} />;
                  }
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableCard>
  );
}

/**
 * A variance, signed and explained.
 *
 * The sign is carried by a word as well as by colour, because "−14" in red and
 * "+14" in green are the same glyph to a reader who cannot separate the two.
 */
function VarianceCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;

  const rounded = Math.round(value);
  if (rounded === 0) return <span className="text-muted-foreground">On plan</span>;

  const ahead = rounded > 0;
  return (
    <span className={cn('font-medium', ahead ? 'text-success-strong' : 'text-destructive')}>
      {ahead ? '+' : '−'}
      {Math.abs(rounded)} pts
      <span className="sr-only"> {ahead ? 'ahead of plan' : 'behind plan'}</span>
    </span>
  );
}
