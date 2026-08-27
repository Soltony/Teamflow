'use client';

import * as React from 'react';
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfQuarter,
} from 'date-fns';
import { ChevronRight, GripVertical } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HealthPill } from '@/components/ui/status-pill';
import { computeCriticalPath, type ScheduleLink } from '@/lib/schedule/critical-path';
import { displayProgress, milestoneProgress } from '@/lib/metrics';
import { milestoneHealth } from '@/lib/ui/health';
import { cn } from '@/lib/utils';

/**
 * A real timeline, rather than a bar chart pretending to be one.
 *
 * What this replaces was a Recharts stacked horizontal bar: each milestone got
 * a transparent "offset" segment and a coloured "duration" segment, and the
 * x-axis was labelled "days from 3 Feb". That arrangement cannot express any
 * of the things a schedule is for. It had no calendar, so you could not see
 * where a quarter ended; no today line, so you could not see where you were;
 * no tasks, only milestones; no dependencies; and no notion of which work was
 * actually driving the end date.
 *
 * This draws a calendar grid and positions work against it. The pieces:
 *
 *  - **Zoom** — day, week, month and quarter, which change the column width
 *    and the header granularity rather than re-fetching anything.
 *  - **Expandable rows** — milestones collapse to a single roll-up bar and
 *    expand to their tasks.
 *  - **Dependencies** — drawn as elbow connectors between task bars.
 *  - **Critical path** — computed by forward/backward pass in
 *    `@/lib/schedule/critical-path` and outlined here.
 *  - **Baseline** — the committed dates drawn as a ghost beneath the current
 *    ones, so a slip is visible rather than inferred.
 *  - **Today** — a single vertical line, because "are we past it" is the most
 *    common question asked of a schedule.
 *
 * Rows are virtualized: a portfolio-wide view can run to thousands of bars,
 * and rendering them all makes scrolling unusable.
 */

export type Zoom = 'day' | 'week' | 'month' | 'quarter';

/** Column width in pixels per day, by zoom level. */
const DAY_WIDTH: Record<Zoom, number> = {
  day: 36,
  week: 12,
  month: 4,
  quarter: 1.6,
};

export const ZOOM_OPTIONS: { value: Zoom; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
];

const ROW_HEIGHT = 40;
const LABEL_WIDTH = 260;
/** Rows rendered beyond the viewport, so scrolling does not reveal blanks. */
const OVERSCAN = 8;

export interface GanttRow {
  id: string;
  kind: 'milestone' | 'task';
  parentId?: string;
  label: string;
  start: Date;
  end: Date;
  baselineStart?: Date | null;
  baselineEnd?: Date | null;
  progress: number;
  status?: string;
  health?: ReturnType<typeof milestoneHealth>;
  /** Ids of predecessor rows, for the connectors. */
  dependsOn?: string[];
  isCritical?: boolean;
  depth: number;
}

export interface GanttTimelineProps {
  rows: GanttRow[];
  zoom: Zoom;
  /** Rows the reader has expanded, by id. */
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  /** Enables drag-to-reschedule. Off unless the reader may edit the project. */
  canReschedule?: boolean;
  onReschedule?: (rowId: string, newStart: Date, newEnd: Date) => void;
  className?: string;
  /** Viewport height in pixels. */
  height?: number;
}

export function GanttTimeline({
  rows,
  zoom,
  expanded,
  onToggleExpand,
  canReschedule = false,
  onReschedule,
  className,
  height = 520,
}: GanttTimelineProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [drag, setDrag] = React.useState<{ id: string; deltaDays: number } | null>(null);

  const dayWidth = DAY_WIDTH[zoom];

  /** The window the chart covers, padded so bars are not flush to the edge. */
  const { origin, totalDays } = React.useMemo(() => {
    if (rows.length === 0) {
      const today = startOfDay(new Date());
      return { origin: today, totalDays: 30 };
    }
    const starts = rows.map((r) => startOfDay(r.start).getTime());
    const ends = rows.map((r) => endOfDay(r.end).getTime());
    // Today is always inside the window, so the today line is reachable even
    // for a plan entirely in the past or future.
    starts.push(startOfDay(new Date()).getTime());
    ends.push(startOfDay(new Date()).getTime());

    const first = addDays(new Date(Math.min(...starts)), -3);
    const last = addDays(new Date(Math.max(...ends)), 3);
    return {
      origin: startOfDay(first),
      totalDays: Math.max(14, differenceInCalendarDays(last, first) + 1),
    };
  }, [rows]);

  const chartWidth = totalDays * dayWidth;

  const xOf = React.useCallback(
    (date: Date) => differenceInCalendarDays(startOfDay(date), origin) * dayWidth,
    [origin, dayWidth],
  );

  const widthOf = React.useCallback(
    (start: Date, end: Date) =>
      // Inclusive of both ends: a one-day task is one column wide, not zero.
      Math.max(dayWidth, (differenceInCalendarDays(startOfDay(end), startOfDay(start)) + 1) * dayWidth),
    [dayWidth],
  );

  // ---- Virtualization ----------------------------------------------------
  const visibleCount = Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2;
  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleRows = rows.slice(firstVisible, firstVisible + visibleCount);

  const rowIndex = React.useMemo(
    () => new Map(rows.map((row, index) => [row.id, index])),
    [rows],
  );

  const todayX = xOf(new Date()) + dayWidth / 2;

  // ---- Drag to reschedule -------------------------------------------------
  const startDrag = (row: GanttRow, event: React.PointerEvent) => {
    if (!canReschedule || !onReschedule) return;
    event.preventDefault();
    const startX = event.clientX;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => {
      setDrag({ id: row.id, deltaDays: Math.round((e.clientX - startX) / dayWidth) });
    };

    const up = (e: PointerEvent) => {
      const deltaDays = Math.round((e.clientX - startX) / dayWidth);
      setDrag(null);
      target.releasePointerCapture(event.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      // A drag that did not actually move anything is a click, not an edit.
      if (deltaDays !== 0) {
        onReschedule(row.id, addDays(row.start, deltaDays), addDays(row.end, deltaDays));
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className={cn('rounded-lg border', className)}>
      <div className="flex">
        {/* The label column is sticky so a row can always be identified, however
            far right the reader has scrolled. */}
        <div
          className="shrink-0 border-r bg-card"
          style={{ width: LABEL_WIDTH }}
          aria-hidden="true"
        >
          <div className="h-12 border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Work
          </div>
          <div style={{ height, overflow: 'hidden', position: 'relative' }}>
            <div style={{ transform: `translateY(-${scrollTop}px)` }}>
              <div style={{ height: rows.length * ROW_HEIGHT, position: 'relative' }}>
                {visibleRows.map((row, i) => {
                  const index = firstVisible + i;
                  const hasChildren = rows.some((r) => r.parentId === row.id);
                  return (
                    <div
                      key={row.id}
                      className="absolute flex w-full items-center gap-1 border-b px-2 text-sm"
                      style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                      <span style={{ width: row.depth * 14 }} />
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => onToggleExpand(row.id)}
                          aria-expanded={expanded.has(row.id)}
                          aria-label={`${expanded.has(row.id) ? 'Collapse' : 'Expand'} ${row.label}`}
                          className="rounded-sm p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 transition-transform',
                              expanded.has(row.id) && 'rotate-90',
                            )}
                          />
                        </button>
                      ) : (
                        <span className="w-5" />
                      )}
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate',
                          row.kind === 'milestone' && 'font-medium',
                        )}
                        title={row.label}
                      >
                        {row.label}
                      </span>
                      {row.isCritical && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-destructive/40 px-1 text-[10px] text-destructive"
                        >
                          Critical
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* The timeline itself. */}
        <div className="min-w-0 flex-1">
          <CalendarHeader origin={origin} totalDays={totalDays} dayWidth={dayWidth} zoom={zoom} />

          <div
            ref={scrollRef}
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            style={{ height, overflow: 'auto' }}
            // Focusable so the chart can be scrolled with the keyboard; a
            // scroll region with no focusable content is mouse-only.
            tabIndex={0}
            role="region"
            aria-label="Project schedule timeline"
            className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div style={{ width: chartWidth, height: rows.length * ROW_HEIGHT, position: 'relative' }}>
              <GridLines origin={origin} totalDays={totalDays} dayWidth={dayWidth} zoom={zoom} />

              {/* Today. One line, labelled, above the grid and below the bars. */}
              {todayX >= 0 && todayX <= chartWidth && (
                <div
                  className="pointer-events-none absolute top-0 z-10 w-px bg-destructive"
                  style={{ left: todayX, height: rows.length * ROW_HEIGHT }}
                  aria-hidden="true"
                />
              )}

              <DependencyLines
                rows={rows}
                rowIndex={rowIndex}
                xOf={xOf}
                widthOf={widthOf}
                visibleFrom={firstVisible}
                visibleTo={firstVisible + visibleCount}
              />

              {visibleRows.map((row, i) => {
                const index = firstVisible + i;
                const dragging = drag?.id === row.id ? drag.deltaDays : 0;
                const left = xOf(row.start) + dragging * dayWidth;
                const width = widthOf(row.start, row.end);

                return (
                  <div
                    key={row.id}
                    className="absolute border-b"
                    style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT, width: chartWidth }}
                  >
                    {/* Baseline, drawn first so the current bar sits over it. */}
                    {row.baselineStart && row.baselineEnd && (
                      <div
                        className="absolute rounded-sm border border-dashed border-muted-foreground/50 bg-muted-foreground/10"
                        style={{
                          left: xOf(row.baselineStart),
                          width: widthOf(row.baselineStart, row.baselineEnd),
                          top: ROW_HEIGHT - 12,
                          height: 6,
                        }}
                        title={`Originally ${format(row.baselineStart, 'd MMM')} – ${format(row.baselineEnd, 'd MMM yyyy')}`}
                      />
                    )}

                    <div
                      onPointerDown={(e) => startDrag(row, e)}
                      className={cn(
                        'absolute top-1.5 flex items-center overflow-hidden rounded-md border text-xs',
                        row.kind === 'milestone'
                          ? 'bg-primary/25 border-primary/50'
                          : 'bg-secondary border-border',
                        row.isCritical && 'border-destructive ring-1 ring-destructive/40',
                        canReschedule && 'cursor-grab active:cursor-grabbing',
                        drag?.id === row.id && 'opacity-80 shadow-lg',
                      )}
                      style={{ left, width, height: ROW_HEIGHT - 16 }}
                      title={`${row.label}: ${format(row.start, 'd MMM')} – ${format(row.end, 'd MMM yyyy')}${
                        row.isCritical ? ' (on the critical path)' : ''
                      }`}
                    >
                      {/* Progress fill, inside the bar rather than beside it. */}
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0',
                          row.kind === 'milestone' ? 'bg-primary/50' : 'bg-primary/30',
                        )}
                        style={{ width: `${Math.min(100, row.progress)}%` }}
                        aria-hidden="true"
                      />
                      {canReschedule && width > 44 && (
                        <GripVertical
                          className="relative ml-1 h-3 w-3 shrink-0 opacity-50"
                          aria-hidden="true"
                        />
                      )}
                      {width > 60 && (
                        <span className="relative truncate px-1.5 font-medium">
                          {displayProgress(row.progress)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* The legend. A chart whose conventions are not stated is a puzzle. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-sm border border-primary/50 bg-primary/25" />
          Milestone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-sm border bg-secondary" />
          Task
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-sm border border-destructive ring-1 ring-destructive/40" />
          On the critical path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-6 rounded-sm border border-dashed border-muted-foreground/50 bg-muted-foreground/10" />
          Originally committed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-destructive" />
          Today
        </span>
      </div>
    </div>
  );
}

/** Two-tier calendar header: the period above, the subdivision below. */
function CalendarHeader({
  origin,
  totalDays,
  dayWidth,
  zoom,
}: {
  origin: Date;
  totalDays: number;
  dayWidth: number;
  zoom: Zoom;
}) {
  const end = addDays(origin, totalDays - 1);

  const majors =
    zoom === 'quarter'
      ? eachMonthOfInterval({ start: startOfQuarter(origin), end }).filter(
          (d) => d.getMonth() % 3 === 0,
        )
      : eachMonthOfInterval({ start: origin, end });

  const minors =
    zoom === 'day'
      ? Array.from({ length: totalDays }, (_, i) => addDays(origin, i))
      : zoom === 'week'
        ? eachWeekOfInterval({ start: origin, end }, { weekStartsOn: 1 })
        : [];

  const xOf = (date: Date) => differenceInCalendarDays(startOfDay(date), origin) * dayWidth;

  return (
    <div className="h-12 border-b bg-muted/50" style={{ width: totalDays * dayWidth, position: 'relative' }}>
      {majors.map((month) => (
        <div
          key={month.toISOString()}
          className="absolute top-0 h-6 border-l px-1.5 text-xs font-semibold text-muted-foreground"
          style={{ left: xOf(month) }}
        >
          {zoom === 'quarter'
            ? `Q${Math.floor(month.getMonth() / 3) + 1} ${format(month, 'yyyy')}`
            : format(month, 'MMMM yyyy')}
        </div>
      ))}

      {minors.map((unit) => (
        <div
          key={unit.toISOString()}
          className="absolute top-6 h-6 border-l px-1 text-[10px] text-muted-foreground"
          style={{ left: xOf(unit) }}
        >
          {zoom === 'day' ? format(unit, 'd') : format(unit, 'd MMM')}
        </div>
      ))}
    </div>
  );
}

/** Faint vertical rules, so a bar can be read against a date. */
function GridLines({
  origin,
  totalDays,
  dayWidth,
  zoom,
}: {
  origin: Date;
  totalDays: number;
  dayWidth: number;
  zoom: Zoom;
}) {
  const end = addDays(origin, totalDays - 1);
  // Only ever one rule per visible unit: a day grid at quarter zoom would be
  // several thousand invisible divs.
  const lines =
    zoom === 'day'
      ? Array.from({ length: totalDays }, (_, i) => addDays(origin, i))
      : zoom === 'week'
        ? eachWeekOfInterval({ start: origin, end }, { weekStartsOn: 1 })
        : eachMonthOfInterval({ start: origin, end });

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {lines.map((date) => {
        const isWeekend = zoom === 'day' && (date.getDay() === 0 || date.getDay() === 6);
        return (
          <div
            key={date.toISOString()}
            className={cn('absolute top-0 h-full w-px', isWeekend ? 'bg-muted' : 'bg-border/50')}
            style={{ left: differenceInCalendarDays(startOfDay(date), origin) * dayWidth }}
          />
        );
      })}
    </div>
  );
}

/**
 * Elbow connectors from each predecessor's finish to its successor's start.
 *
 * Drawn only for pairs where at least one end is on screen — a plan with two
 * thousand links would otherwise emit two thousand SVG paths on every scroll.
 */
function DependencyLines({
  rows,
  rowIndex,
  xOf,
  widthOf,
  visibleFrom,
  visibleTo,
}: {
  rows: GanttRow[];
  rowIndex: Map<string, number>;
  xOf: (d: Date) => number;
  widthOf: (s: Date, e: Date) => number;
  visibleFrom: number;
  visibleTo: number;
}) {
  const paths: React.ReactNode[] = [];

  for (const row of rows) {
    for (const predecessorId of row.dependsOn ?? []) {
      const fromIndex = rowIndex.get(predecessorId);
      const toIndex = rowIndex.get(row.id);
      if (fromIndex === undefined || toIndex === undefined) continue;

      const onScreen =
        (fromIndex >= visibleFrom && fromIndex < visibleTo) ||
        (toIndex >= visibleFrom && toIndex < visibleTo);
      if (!onScreen) continue;

      const from = rows[fromIndex];
      const x1 = xOf(from.start) + widthOf(from.start, from.end);
      const y1 = fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x2 = xOf(row.start);
      const y2 = toIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

      // Out of the predecessor, across, then into the successor's left edge.
      const midX = Math.max(x1 + 8, x2 - 12);
      paths.push(
        <path
          key={`${predecessorId}->${row.id}`}
          d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          markerEnd="url(#gantt-arrow)"
        />,
      );
    }
  }

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] text-muted-foreground"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="gantt-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 1 L 7 4 L 0 7 z" fill="currentColor" />
        </marker>
      </defs>
      {paths}
    </svg>
  );
}

/**
 * Turns a project into rows, with the critical path already worked out.
 *
 * Exported separately from the chart so the same derivation can be reused by
 * the portfolio-wide schedule without duplicating the flattening rules.
 */
export function buildGanttRows(
  project: any,
  expanded: Set<string>,
): { rows: GanttRow[]; criticalCount: number; cyclicLinks: number } {
  const milestones = project.milestones ?? [];

  const allTasks = milestones.flatMap((m: any) =>
    (m.tasks ?? []).map((t: any) => ({ ...t, milestoneId: m.id })),
  );

  const links: ScheduleLink[] = allTasks.flatMap((task: any) =>
    (task.dependsOn ?? []).map((d: any) => ({
      predecessorId: d.predecessorId,
      successorId: task.id,
      type: d.type,
      lagDays: d.lagDays,
    })),
  );

  const { floats, cyclicLinks } = computeCriticalPath(
    allTasks.map((t: any) => ({ id: t.id, startDate: t.startDate, endDate: t.endDate })),
    links,
  );

  const rows: GanttRow[] = [];
  let criticalCount = 0;

  for (const milestone of milestones) {
    const tasks = (milestone.tasks ?? []).slice().sort(
      (a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );

    rows.push({
      id: milestone.id,
      kind: 'milestone',
      label: milestone.title,
      start: new Date(milestone.startDate),
      end: new Date(milestone.dueDate),
      baselineStart: milestone.baselineStartDate ? new Date(milestone.baselineStartDate) : null,
      baselineEnd: milestone.baselineDueDate ? new Date(milestone.baselineDueDate) : null,
      progress: milestoneProgress(milestone),
      health: milestoneHealth(milestone),
      depth: 0,
    });

    if (!expanded.has(milestone.id)) continue;

    for (const task of tasks) {
      const critical = floats.get(task.id)?.isCritical ?? false;
      if (critical) criticalCount += 1;

      rows.push({
        id: task.id,
        kind: 'task',
        parentId: milestone.id,
        label: task.title,
        start: new Date(task.startDate),
        end: new Date(task.endDate),
        baselineStart: task.baselineStartDate ? new Date(task.baselineStartDate) : null,
        baselineEnd: task.baselineEndDate ? new Date(task.baselineEndDate) : null,
        progress: Number(task.progress ?? 0),
        status: task.status,
        dependsOn: (task.dependsOn ?? []).map((d: any) => d.predecessorId),
        isCritical: critical,
        depth: 1,
      });
    }
  }

  return { rows, criticalCount, cyclicLinks: cyclicLinks.length };
}
