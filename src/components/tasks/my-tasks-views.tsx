'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, CheckCircle2, CircleDot } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { BulkActionBar, DataToolbar, ALL } from '@/components/ui/data-toolbar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { bulkUpdateTaskDueDate, bulkUpdateTaskStatus } from '@/app/my-tasks/bulk-actions';
import {
  TASK_GROUPING_OPTIONS,
  TaskBoardView,
  TaskCalendarView,
  TaskListView,
  TaskViewSwitcher,
  isTaskOverdue,
  type TaskGrouping,
  type TaskLike,
  type TaskView,
} from './task-views';
import { useTablePreferences } from '@/hooks/use-table-preferences';
import { TASK_SORT_OPTIONS, sortTasks, type TaskSort } from '@/lib/ui/sort';

/**
 * A set of tasks with the controls that make it usable.
 *
 * Shared by My tasks and Team view, which want exactly the same affordances
 * over different sets of rows. Keeping it in one place is what stops the two
 * screens drifting into different answers for "is this overdue".
 */

export interface MyTasksViewsProps {
  tasks: TaskLike[];
  onDataChange: () => void;
  /** Turns off selection where the reader cannot change anything. */
  canEdit?: boolean;
  storageKey: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function TaskWorkspace({
  tasks,
  onDataChange,
  canEdit = true,
  storageKey,
  emptyTitle,
  emptyDescription,
}: MyTasksViewsProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();

  // View and grouping are working preferences, so they persist per person.
  const [prefs, setPrefs] = useTablePreferences<{
    columns: string[];
    sort: { column: string; direction: 'asc' | 'desc' };
  }>(storageKey, {
    columns: ['list', 'none'],
    sort: { column: 'due', direction: 'asc' },
  });

  const view = (prefs.columns?.[0] ?? 'list') as TaskView;
  const grouping = (prefs.columns?.[1] ?? 'none') as TaskGrouping;
  const sort = (prefs.sort?.column ?? 'due') as TaskSort;

  const setView = (next: TaskView) => setPrefs({ columns: [next, grouping] });
  const setGrouping = (next: TaskGrouping) => setPrefs({ columns: [view, next] });
  const setSort = (next: TaskSort) => setPrefs({ sort: { column: next, direction: 'asc' } });

  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState(ALL);
  const [project, setProject] = React.useState(ALL);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [dueDateOpen, setDueDateOpen] = React.useState(false);

  const projectOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const task of tasks) {
      if (task.projectId && task.projectName) seen.set(task.projectId, task.projectName);
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [tasks]);

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      if (status === 'OVERDUE' ? !isTaskOverdue(task) : status !== ALL && task.status !== status)
        return false;
      if (project !== ALL && task.projectId !== project) return false;
      if (!query) return true;
      return (
        task.title.toLowerCase().includes(query) ||
        (task.projectName ?? '').toLowerCase().includes(query) ||
        (task.assigneeNames ?? []).some((n) => n.toLowerCase().includes(query))
      );
    });
    return sortTasks(filtered, sort) as TaskLike[];
  }, [tasks, search, status, project, sort]);

  // Selections are pruned as the visible set changes, so a bulk action can
  // never apply to a row the reader has filtered away and forgotten about.
  React.useEffect(() => {
    setSelected((current) => {
      const live = new Set(visible.map((t) => t.id));
      const next = new Set([...current].filter((id) => live.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visible]);

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAll = (on: boolean) =>
    setSelected(on ? new Set(visible.map((t) => t.id)) : new Set());

  const report = (result: { updated: number; skipped: number; reason?: string }, verb: string) => {
    setSelected(new Set());
    if (result.updated === 0) {
      toast({
        title: 'Nothing was changed',
        description: result.reason ?? 'None of those could be updated.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: `${result.updated} task${result.updated === 1 ? '' : 's'} ${verb}`,
        // Partial success says so, rather than quietly dropping the rest.
        description:
          result.skipped > 0
            ? `${result.skipped} could not be: ${result.reason ?? 'not permitted.'}`
            : undefined,
      });
    }
    onDataChange();
  };

  const applyStatus = (next: 'TODO' | 'IN_PROGRESS') => {
    const ids = [...selected];
    startTransition(async () => {
      report(await bulkUpdateTaskStatus({ taskIds: ids, status: next }), 'moved');
    });
  };

  const applyDueDate = (date: Date | undefined) => {
    if (!date) return;
    const ids = [...selected];
    setDueDateOpen(false);
    startTransition(async () => {
      report(
        await bulkUpdateTaskDueDate({ taskIds: ids, endDate: date.toISOString() }),
        'rescheduled',
      );
    });
  };

  const overdueCount = React.useMemo(() => tasks.filter((t) => isTaskOverdue(t)).length, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TaskViewSwitcher value={view} onChange={setView} />

        {view !== 'calendar' && (
          <Select value={grouping} onValueChange={(v) => setGrouping(v as TaskGrouping)}>
            <SelectTrigger className="w-full lg:w-[220px]" aria-label="Group tasks by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_GROUPING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DataToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search tasks, projects or people…',
          label: 'Search tasks',
        }}
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: status,
            onChange: setStatus,
            options: [
              // Overdue is offered as a status even though it is not one: it is
              // the filter people actually reach for, and making them work it
              // out from dates defeats the point.
              { value: 'OVERDUE', label: `Overdue (${overdueCount})` },
              { value: 'TODO', label: 'To do' },
              { value: 'IN_PROGRESS', label: 'In progress' },
              { value: 'PENDING_REVIEW', label: 'Awaiting review' },
              { value: 'DONE', label: 'Done' },
            ],
            allLabel: 'Any status',
          },
          ...(projectOptions.length > 1
            ? [
                {
                  id: 'project',
                  label: 'Project',
                  value: project,
                  onChange: setProject,
                  options: projectOptions,
                  allLabel: 'All projects',
                },
              ]
            : []),
        ]}
        sort={
          view === 'list'
            ? {
                value: sort,
                onChange: (v) => setSort(v as TaskSort),
                options: TASK_SORT_OPTIONS,
              }
            : undefined
        }
        count={{ showing: visible.length, total: tasks.length, noun: 'tasks' }}
        onClearAll={() => {
          setSearch('');
          setStatus(ALL);
          setProject(ALL);
        }}
      />

      <Card>
        <CardContent className="pt-6">
          {view === 'list' && (
            <TaskListView
              tasks={visible}
              grouping={grouping}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              selectable={canEdit}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
            />
          )}
          {view === 'board' && (
            <TaskBoardView
              tasks={visible}
              grouping={grouping}
              selected={selected}
              onToggle={toggle}
              selectable={canEdit}
            />
          )}
          {view === 'calendar' && <TaskCalendarView tasks={visible} />}
        </CardContent>
      </Card>

      {canEdit && (
        <BulkActionBar
          selectedCount={selected.size}
          noun="task"
          onClear={() => setSelected(new Set())}
        >
          <Button size="sm" variant="outline" onClick={() => applyStatus('TODO')} disabled={isPending}>
            <CircleDot className="h-4 w-4" aria-hidden="true" />
            To do
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyStatus('IN_PROGRESS')}
            disabled={isPending}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            In progress
          </Button>

          <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={isPending}>
                <CalendarIcon className="h-4 w-4" aria-hidden="true" />
                Set due date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" onSelect={applyDueDate} initialFocus />
            </PopoverContent>
          </Popover>
        </BulkActionBar>
      )}
    </div>
  );
}
