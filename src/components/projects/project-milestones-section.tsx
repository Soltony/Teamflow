'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Scale } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataToolbar, ALL } from '@/components/ui/data-toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { HealthPill, TaskStatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { displayProgress, milestoneProgress } from '@/lib/metrics';
import { daysUntil, milestoneHealth, type Health } from '@/lib/ui/health';
import { MILESTONE_SORT_OPTIONS, sortMilestones, type MilestoneSort } from '@/lib/ui/sort';

/**
 * A project's milestones and the tasks under them.
 *
 * Lifted out of project-view.tsx, which held every section's markup inline.
 * Beyond the file size, this section needs filter and sort state of its own,
 * and that state has no business re-rendering the issue register.
 *
 * What changed for the reader: each milestone now says whether it is going to
 * make it, not just how far along it is, and the list can be reordered to put
 * the trouble at the top. Previously they came back in insertion order with a
 * bar and a percentage, so finding the one that had slipped meant opening all
 * of them.
 */

const HEALTH_FILTER_OPTIONS = [
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'AT_RISK', label: 'Behind schedule' },
  { value: 'ON_TRACK', label: 'On track' },
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'COMPLETE', label: 'Complete' },
];

export function ProjectMilestonesSection({ project }: { project: any }) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [health, setHealth] = React.useState<string>(ALL);
  const [sort, setSort] = React.useState<MilestoneSort>('health');

  const milestones: any[] = React.useMemo(() => project.milestones ?? [], [project.milestones]);

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = milestones.filter((m) => {
      if (health !== ALL && milestoneHealth(m) !== health) return false;
      if (!query) return true;
      // Matches task titles too: people search for the piece of work they
      // remember, not the milestone it happens to sit under.
      return (
        String(m.title ?? '').toLowerCase().includes(query) ||
        String(m.description ?? '').toLowerCase().includes(query) ||
        (m.tasks ?? []).some((t: any) => String(t.title ?? '').toLowerCase().includes(query))
      );
    });

    return sortMilestones(filtered, sort);
  }, [milestones, search, health, sort]);

  const clearAll = () => {
    setSearch('');
    setHealth(ALL);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Milestones and tasks</CardTitle>
        <CardDescription>
          Every milestone in this project, whether it is going to make its date, and the tasks
          beneath it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestones.length > 0 && (
          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search milestones and tasks…',
              label: 'Search milestones and tasks',
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
            ]}
            sort={{
              value: sort,
              onChange: (v) => setSort(v as MilestoneSort),
              options: MILESTONE_SORT_OPTIONS,
            }}
            count={{ showing: visible.length, total: milestones.length, noun: 'milestones' }}
            onClearAll={clearAll}
          />
        )}

        {milestones.length === 0 ? (
          <EmptyState
            title="No milestones yet"
            description="Break the work down into milestones so progress can be tracked and reported."
            compact
          />
        ) : visible.length === 0 ? (
          <EmptyState
            variant="no-match"
            title="No milestones match"
            description="This project has milestones — none of them fit the filters you have set."
            compact
          />
        ) : (
          <Accordion type="multiple" className="w-full space-y-2">
            {visible.map((milestone: any) => (
              <MilestoneRow
                key={milestone.id}
                milestone={milestone}
                onOpenTask={(taskId) => router.push(`/tasks/${taskId}`)}
              />
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function MilestoneRow({
  milestone,
  onOpenTask,
}: {
  milestone: any;
  onOpenTask: (taskId: string) => void;
}) {
  const progress = milestoneProgress(milestone);
  const health = milestoneHealth(milestone);
  const remaining = daysUntil(milestone);
  const tasks: any[] = milestone.tasks ?? [];
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <AccordionItem value={milestone.id} className="rounded-md border px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full flex-col gap-3 pr-2 text-left lg:flex-row lg:items-center lg:gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{milestone.title}</span>
              <HealthPill health={health} label={healthLabel(health, remaining)} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                Due {format(parseISO(milestone.dueDate), 'd MMM yyyy')}
              </span>
              <span className="inline-flex items-center gap-1">
                <Scale className="h-3 w-3" aria-hidden="true" />
                Weight {milestone.weight}%
              </span>
              <span>
                {doneCount} of {tasks.length} task{tasks.length === 1 ? '' : 's'} done
              </span>
            </div>
          </div>

          <div className="flex w-full items-center gap-3 lg:w-56 lg:shrink-0">
            <Progress
              value={progress}
              className="h-2 flex-1"
              aria-label={`${milestone.title}: ${displayProgress(progress)}% complete`}
            />
            <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
              {displayProgress(progress)}%
            </span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="pb-4 pt-2">
        {milestone.description && (
          <p className="mb-3 text-sm text-muted-foreground">{milestone.description}</p>
        )}

        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks in this milestone"
            description="A milestone with no tasks counts as unstarted work against its weight."
            compact
          />
        ) : (
          <Table scrollLabel={`Tasks in ${milestone.title}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task: any) => (
                <TableRow
                  key={task.id}
                  onClick={() => onOpenTask(task.id)}
                  // Rows are the primary way into a task, so they must be
                  // reachable without a mouse. The row was clickable before
                  // and did nothing at all on a keyboard.
                  tabIndex={0}
                  role="link"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenTask(task.id);
                    }
                  }}
                  className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>
                    <TaskStatusPill status={task.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={task.progress || 0} className="h-2 w-16" />
                      <span className="tabular-nums">{task.progress || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(parseISO(task.endDate), 'd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{task.weight}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * The health pill's wording, made specific where a number helps.
 *
 * "Overdue" is true but vague; "9 days late" is the thing somebody repeats in
 * a status meeting.
 */
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
