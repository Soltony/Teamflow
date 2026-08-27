'use client';

import * as React from 'react';
import { AlertTriangle, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import {
  GanttTimeline,
  ZOOM_OPTIONS,
  buildGanttRows,
  type Zoom,
} from '@/components/schedule/gantt-timeline';
import { rescheduleWork } from '@/app/projects/schedule-actions';

/**
 * The project's schedule, as a calendar.
 *
 * Drag-to-reschedule is offered only to somebody who may already edit the
 * project. That is not a UI nicety: dragging a bar writes dates, so the same
 * permission that guards the edit form has to guard this, and the server
 * checks it again regardless of what this component decides to render.
 */
export function ProjectScheduleTab({ project }: { project: any }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [zoom, setZoom] = React.useState<Zoom>('week');
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    // Milestones start expanded, because a schedule showing only milestone
    // roll-ups is the chart this replaced.
    return new Set((project.milestones ?? []).map((m: any) => m.id));
  });
  const [isSaving, setSaving] = React.useState(false);

  const canReschedule = hasPermission('projects:update');

  const { rows, criticalCount, cyclicLinks } = React.useMemo(
    () => buildGanttRows(project, expanded),
    [project, expanded],
  );

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allExpanded = (project.milestones ?? []).every((m: any) => expanded.has(m.id));

  const handleReschedule = async (rowId: string, start: Date, end: Date) => {
    setSaving(true);
    const result = await rescheduleWork(rowId, start.toISOString(), end.toISOString());
    setSaving(false);

    if (result.success) {
      toast({
        title: 'Dates moved',
        // Says what did *not* happen as well as what did: moving a bar does not
        // renegotiate the commitment, and somebody dragging a milestone should
        // not be left thinking it did.
        description:
          'The plan has been updated. The original committed dates are unchanged, so reporting still measures against them.',
      });
    } else {
      toast({
        title: 'Those dates were not saved',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  if ((project.milestones ?? []).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Nothing to schedule yet"
            description="This project has no milestones, so there is no timeline to draw. Add milestones by editing the project."
            compact
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              {criticalCount > 0
                ? `${criticalCount} task${criticalCount === 1 ? '' : 's'} on the critical path — any slip on those moves the end date.`
                : 'Milestones and tasks against the calendar, with the originally committed dates beneath.'}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setExpanded(
                  allExpanded
                    ? new Set()
                    : new Set((project.milestones ?? []).map((m: any) => m.id)),
                )
              }
            >
              {allExpanded ? (
                <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
              )}
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Button>

            <Select value={zoom} onValueChange={(v) => setZoom(v as Zoom)}>
              <SelectTrigger className="w-[130px]" aria-label="Timeline zoom">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZOOM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {cyclicLinks > 0 && (
          /*
           * A dependency cycle is a data problem the planner has to fix, and
           * refusing to draw the chart would hide it. The affected links are
           * excluded from the critical-path calculation and said so here.
           */
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" aria-hidden="true" />
            <span>
              {cyclicLinks} dependenc{cyclicLinks === 1 ? 'y forms' : 'ies form'} a loop — work
              that waits on itself. Those links are ignored when working out the critical path.
            </span>
          </p>
        )}

        <GanttTimeline
          rows={rows}
          zoom={zoom}
          expanded={expanded}
          onToggleExpand={toggle}
          canReschedule={canReschedule && !isSaving}
          onReschedule={handleReschedule}
        />

        {canReschedule && (
          <p className="text-xs text-muted-foreground">
            Drag a bar to move it. Dragging changes the plan, not the commitment — the baseline
            stays where it was.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
