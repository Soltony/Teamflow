'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LayoutList,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { TaskStatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableCard,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { daysUntil } from '@/lib/ui/health';
import { cn } from '@/lib/utils';

/**
 * The same tasks, three ways.
 *
 * One view cannot answer every question a task list is asked. A list is right
 * for "what is overdue"; a board is right for "where is everything stuck"; a
 * calendar is right for "what does next week look like". The old screen had
 * only a list, grouped into fixed sections nobody could change, so the second
 * and third questions could not be asked at all.
 *
 * Overdue is marked in three ways deliberately — an icon, the word "overdue",
 * and colour — because colour alone excludes about one man in twelve, and a
 * red row that is merely red says nothing when printed.
 */

export type TaskView = 'list' | 'board' | 'calendar';
export type TaskGrouping = 'none' | 'project' | 'due' | 'status';

export const TASK_VIEW_OPTIONS: { value: TaskView; label: string; icon: typeof LayoutList }[] = [
  { value: 'list', label: 'List', icon: LayoutList },
  { value: 'board', label: 'Board', icon: Columns3 },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export const TASK_GROUPING_OPTIONS: { value: TaskGrouping; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'project', label: 'Group by project' },
  { value: 'due', label: 'Group by when it is due' },
  { value: 'status', label: 'Group by status' },
];

export interface TaskLike {
  id: string;
  title: string;
  status: string;
  endDate: string;
  progress?: number | null;
  projectName?: string | null;
  projectId?: string | null;
  milestoneTitle?: string | null;
  assigneeNames?: string[];
}

/** Whether a task is late, said once so every view agrees. */
export function isTaskOverdue(task: TaskLike, now: Date = new Date()): boolean {
  if (task.status === 'DONE' || task.status === 'CANCELLED') return false;
  const remaining = daysUntil({ endDate: task.endDate }, now);
  return remaining !== null && remaining < 0;
}

/**
 * The overdue marker, used identically in all three views.
 *
 * Icon, words and colour together.
 */
export function OverdueFlag({ task, now }: { task: TaskLike; now?: Date }) {
  const remaining = daysUntil({ endDate: task.endDate }, now ?? new Date());
  if (!isTaskOverdue(task, now) || remaining === null) return null;
  const late = Math.abs(remaining);

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {late} day{late === 1 ? '' : 's'} overdue
    </span>
  );
}

/** Buckets a task falls into when grouped. */
function groupKeyFor(task: TaskLike, grouping: TaskGrouping, now: Date): string {
  switch (grouping) {
    case 'project':
      return task.projectName ?? 'No project';
    case 'status':
      return task.status;
    case 'due': {
      if (isTaskOverdue(task, now)) return 'Overdue';
      const remaining = daysUntil({ endDate: task.endDate }, now);
      if (remaining === null) return 'No date';
      if (remaining === 0) return 'Due today';
      if (remaining <= 7) return 'This week';
      if (remaining <= 30) return 'This month';
      return 'Later';
    }
    default:
      return '';
  }
}

/** Groups keep a deliberate order; alphabetical would bury Overdue. */
const DUE_ORDER = ['Overdue', 'Due today', 'This week', 'This month', 'Later', 'No date'];
const STATUS_ORDER = ['IN_PROGRESS', 'PENDING_REVIEW', 'TODO', 'DONE', 'CANCELLED'];

export function groupTasks(
  tasks: TaskLike[],
  grouping: TaskGrouping,
  now: Date = new Date(),
): { key: string; label: string; tasks: TaskLike[] }[] {
  if (grouping === 'none') return [{ key: 'all', label: '', tasks }];

  const map = new Map<string, TaskLike[]>();
  for (const task of tasks) {
    const key = groupKeyFor(task, grouping, now);
    const list = map.get(key);
    if (list) list.push(task);
    else map.set(key, [task]);
  }

  const order = grouping === 'due' ? DUE_ORDER : grouping === 'status' ? STATUS_ORDER : null;

  const entries = [...map.entries()].map(([key, list]) => ({
    key,
    label: grouping === 'status' ? statusLabel(key) : key,
    tasks: list,
  }));

  if (!order) return entries.sort((a, b) => a.label.localeCompare(b.label));

  return entries.sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function statusLabel(status: string) {
  switch (status) {
    case 'TODO':
      return 'To do';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'PENDING_REVIEW':
      return 'Awaiting review';
    case 'DONE':
      return 'Done';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

export interface TaskViewProps {
  tasks: TaskLike[];
  grouping: TaskGrouping;
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onToggleAll?: (on: boolean) => void;
  selectable?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

/* ---------------------------------------------------------------- list --- */

export function TaskListView({
  tasks,
  grouping,
  selected,
  onToggle,
  onToggleAll,
  selectable = true,
  emptyTitle = 'No tasks',
  emptyDescription,
}: TaskViewProps) {
  const now = React.useMemo(() => new Date(), []);
  const groups = React.useMemo(() => groupTasks(tasks, grouping, now), [tasks, grouping, now]);

  if (tasks.length === 0) {
    return <EmptyState variant="none-yours" title={emptyTitle} description={emptyDescription} compact />;
  }

  const allSelected = tasks.length > 0 && tasks.every((t) => selected.has(t.id));
  const someSelected = tasks.some((t) => selected.has(t.id)) && !allSelected;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          {group.label && (
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              {group.label}
              <Badge variant="secondary" className="font-normal tabular-nums">
                {group.tasks.length}
              </Badge>
            </h3>
          )}

          {/* Desktop: a table. Below sm it becomes cards — see TaskCards. */}
          <div className="hidden sm:block">
            <TableCard>
              <Table scrollLabel={group.label ? `Tasks: ${group.label}` : 'Tasks'}>
                <TableHeader>
                  <TableRow>
                    {selectable && (
                      <TableHead className="w-10">
                        {onToggleAll && group.key === groups[0].key && (
                          <Checkbox
                            checked={someSelected ? 'indeterminate' : allSelected}
                            onCheckedChange={(v) => onToggleAll(v === true)}
                            aria-label="Select all tasks"
                          />
                        )}
                      </TableHead>
                    )}
                    <TableHead>Task</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.tasks.map((task) => (
                    <TableRow
                      key={task.id}
                      data-state={selected.has(task.id) ? 'selected' : undefined}
                      className={cn(isTaskOverdue(task, now) && 'bg-destructive/5')}
                    >
                      {selectable && (
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selected.has(task.id)}
                            onCheckedChange={(v) => onToggle(task.id, v === true)}
                            aria-label={`Select ${task.title}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="max-w-[280px] font-medium">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="block truncate rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {task.title}
                        </Link>
                        {task.milestoneTitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {task.milestoneTitle}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-muted-foreground">
                        {task.projectName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <TaskStatusPill status={task.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={task.progress ?? 0} className="h-2 w-14" />
                          <span className="tabular-nums">{task.progress ?? 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(parseISO(task.endDate), 'd MMM yyyy')}
                        <span className="block">
                          <OverdueFlag task={task} now={now} />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          </div>

          <TaskCards
            tasks={group.tasks}
            selected={selected}
            onToggle={onToggle}
            selectable={selectable}
            now={now}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The phone layout.
 *
 * Not a shrunken table — a table with six columns on a 390px screen is either
 * a horizontal scroll nobody discovers or six columns of two characters each.
 * Cards stack the same facts in reading order.
 */
function TaskCards({
  tasks,
  selected,
  onToggle,
  selectable,
  now,
}: {
  tasks: TaskLike[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  selectable: boolean;
  now: Date;
}) {
  return (
    <ul className="space-y-2 sm:hidden">
      {tasks.map((task) => (
        <li key={task.id}>
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3',
              isTaskOverdue(task, now) && 'border-destructive/40 bg-destructive/5',
              selected.has(task.id) && 'border-ring bg-secondary/40',
            )}
          >
            {selectable && (
              <Checkbox
                checked={selected.has(task.id)}
                onCheckedChange={(v) => onToggle(task.id, v === true)}
                aria-label={`Select ${task.title}`}
                className="mt-0.5 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <Link
                href={`/tasks/${task.id}`}
                className="block rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {task.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {task.projectName ?? 'No project'}
                {task.milestoneTitle ? ` · ${task.milestoneTitle}` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <TaskStatusPill status={task.status} />
                <OverdueFlag task={task} now={now} />
              </div>
              <div className="flex items-center gap-2">
                <Progress value={task.progress ?? 0} className="h-2 flex-1" />
                <span className="text-xs tabular-nums">{task.progress ?? 0}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Due {format(parseISO(task.endDate), 'd MMM yyyy')}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- board --- */

const BOARD_COLUMNS = ['TODO', 'IN_PROGRESS', 'PENDING_REVIEW', 'DONE'] as const;

export function TaskBoardView({ tasks, selected, onToggle, selectable = true }: TaskViewProps) {
  const now = React.useMemo(() => new Date(), []);

  if (tasks.length === 0) {
    return <EmptyState variant="none-yours" title="No tasks to show" compact />;
  }

  return (
    // Scrolls sideways on a phone: four columns is the point of a board, and
    // stacking them would just be the list again.
    <div className="flex gap-4 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map((status) => {
        const column = tasks.filter((t) => t.status === status);
        return (
          <section
            key={status}
            className="flex w-[260px] shrink-0 flex-col rounded-lg border bg-muted/30"
            aria-label={`${statusLabel(status)}: ${column.length} tasks`}
          >
            <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <TaskStatusPill status={status} />
              <span className="text-sm font-semibold tabular-nums">{column.length}</span>
            </header>

            <ul className="flex-1 space-y-2 p-2">
              {column.length === 0 ? (
                <li className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Nothing here
                </li>
              ) : (
                column.map((task) => (
                  <li key={task.id}>
                    <div
                      className={cn(
                        'space-y-2 rounded-md border bg-card p-2.5',
                        isTaskOverdue(task, now) && 'border-destructive/40',
                        selected.has(task.id) && 'border-ring bg-secondary/40',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {selectable && (
                          <Checkbox
                            checked={selected.has(task.id)}
                            onCheckedChange={(v) => onToggle(task.id, v === true)}
                            aria-label={`Select ${task.title}`}
                            className="mt-0.5 shrink-0"
                          />
                        )}
                        <Link
                          href={`/tasks/${task.id}`}
                          className="min-w-0 flex-1 rounded-sm text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {task.title}
                        </Link>
                      </div>
                      {task.projectName && (
                        <p className="truncate text-xs text-muted-foreground">
                          {task.projectName}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Progress value={task.progress ?? 0} className="h-1.5 flex-1" />
                        <span className="text-xs tabular-nums">{task.progress ?? 0}%</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(task.endDate), 'd MMM')}
                        </span>
                        <OverdueFlag task={task} now={now} />
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ calendar --- */

export function TaskCalendarView({ tasks }: { tasks: TaskLike[] }) {
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const now = React.useMemo(() => new Date(), []);

  const days = React.useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const byDay = React.useMemo(() => {
    const map = new Map<string, TaskLike[]>();
    for (const task of tasks) {
      const key = format(parseISO(task.endDate), 'yyyy-MM-dd');
      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [tasks]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{format(month, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(subMonths(month, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            This month
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-px border-b bg-border">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div
                key={day}
                className="bg-muted/50 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayTasks = byDay.get(key) ?? [];
              const outside = !isSameMonth(day, month);

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[96px] bg-card p-1.5',
                    outside && 'bg-muted/30 text-muted-foreground',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        isToday(day) &&
                          'flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayTasks.length > 2 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <li key={task.id}>
                        <Link
                          href={`/tasks/${task.id}`}
                          title={`${task.title}${task.projectName ? ` — ${task.projectName}` : ''}`}
                          className={cn(
                            'flex items-center gap-1 rounded-sm border px-1 py-0.5 text-[11px] leading-tight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isTaskOverdue(task, now)
                              ? 'border-destructive/40 bg-destructive/10 text-destructive'
                              : 'bg-secondary',
                          )}
                        >
                          {isTaskOverdue(task, now) && (
                            <AlertTriangle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate">{task.title}</span>
                        </Link>
                      </li>
                    ))}
                    {dayTasks.length > 3 && (
                      <li className="px-1 text-[10px] text-muted-foreground">
                        +{dayTasks.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Tasks are placed on their due date. Overdue ones carry a warning icon as well as the
        colour.
      </p>
    </div>
  );
}

/** The List / Board / Calendar switcher, as a real radio group. */
export function TaskViewSwitcher({
  value,
  onChange,
  className,
}: {
  value: TaskView;
  onChange: (view: TaskView) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Task view"
      className={cn('inline-flex rounded-md border p-0.5', className)}
    >
      {TASK_VIEW_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
