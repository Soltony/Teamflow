'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MetricInfo } from '@/components/metrics/metric-info';
import type { MetricKey } from '@/lib/metrics/definitions';
import { cn } from '@/lib/utils';

/**
 * A single figure, stated the same way everywhere.
 *
 * The dashboard, the portfolio report and the project page each had their own
 * KPI card, and they disagreed on the things a reader uses to scan: where the
 * number sits, whether the caption explains the figure or repeats it, and
 * whether a card with nothing behind it is still clickable. The last one
 * mattered most — a card reading "0" that navigated to an empty list is a dead
 * end somebody has to back out of.
 *
 * A card with `href` and a non-zero value becomes a link. One with nothing to
 * show stays inert, and says so quietly rather than pretending.
 */

export type StatTone = 'neutral' | 'positive' | 'warning' | 'critical';

const TONE_VALUE: Record<StatTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-success-strong',
  warning: 'text-warning-strong',
  critical: 'text-destructive',
};

const TONE_ICON: Record<StatTone, string> = {
  neutral: 'text-muted-foreground',
  positive: 'text-success-strong',
  warning: 'text-warning-strong',
  critical: 'text-destructive',
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** What the number counts. One short line, in the reader's terms. */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  /** Adds the "how is this calculated" tooltip beside the label. */
  metric?: MetricKey;
  /** Drill-down target. Ignored when `interactive` resolves to false. */
  href?: string;
  /**
   * Whether the drill-down is worth offering. Defaults to true; pass the count
   * so a zero card does not lead somewhere empty.
   */
  interactive?: boolean;
  /** Renders a bar under the value — for percentages. */
  progress?: number;
  className?: string;
  /**
   * Makes the card a filter toggle rather than a link.
   *
   * My Tasks already worked this way, but as an `onClick` on a plain `div`:
   * no keyboard access, no announced state, and nothing telling a screen
   * reader the card was a control at all. A real button fixes all three.
   */
  onClick?: () => void;
  /** Whether this filter is currently applied. Requires `onClick`. */
  selected?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  metric,
  href,
  interactive = true,
  progress,
  className,
  onClick,
  selected,
}: StatCardProps) {
  const isLink = Boolean(href) && interactive && !onClick;
  const isButton = Boolean(onClick);

  const card = (
    <Card
      className={cn(
        'h-full text-left transition-colors',
        isLink && 'group-hover:border-ring group-hover:bg-muted/50',
        isButton && 'group-hover:bg-muted/50',
        selected && 'border-ring bg-secondary',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        {/*
          Small caps rather than sentence case: the label is a column heading
          for the figure below it, and setting it apart in weight and case is
          what stops a reader parsing it as the first line of the value.
        */}
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {metric && <MetricInfo metric={metric} />}
        </CardTitle>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', TONE_ICON[tone])} aria-hidden="true" />}
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        <div className={cn('text-2xl font-bold tabular-nums', TONE_VALUE[tone])}>{value}</div>
        {typeof progress === 'number' && (
          <Progress value={progress} className="h-2" aria-label={`${label}: ${Math.round(progress)}%`} />
        )}
        {hint && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="min-w-0">{hint}</span>
            {isLink && (
              <ArrowRight
                className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (isButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        // `aria-pressed` is what makes this a toggle rather than a button that
        // does something once: the applied state is announced, not just tinted.
        aria-pressed={selected ?? false}
        className="group block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {card}
      </button>
    );
  }

  if (!isLink) return card;

  return (
    <Link
      href={href!}
      className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  );
}

/**
 * The row a set of stat cards sits in.
 *
 * Two across from the smallest screen up, then widening. A single column of
 * KPI cards on a phone pushes the actual content below three or four scrolls
 * of headline figures; paired, the same set reads as one block. Four 2xl
 * numbers in a 768px row is the other failure — their captions wrap to three
 * lines each — so the four-up step waits for xl.
 */
export function StatCardGrid({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:gap-4',
        columns === 3 && 'lg:grid-cols-3',
        columns === 4 && 'xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
