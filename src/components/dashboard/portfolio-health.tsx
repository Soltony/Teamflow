'use client';

import * as React from 'react';
import { Activity, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RagPill } from '@/components/ui/status-pill';
import { MetricInfo } from '@/components/metrics/metric-info';
import type { PortfolioRag, Rag } from '@/lib/metrics';
import { cn } from '@/lib/utils';

/**
 * How the portfolio is doing, above everything else on the page.
 *
 * The dashboard used to open with a card headed "Welcome to NIB EPMO" and four
 * lines of copy nobody reads twice — the most valuable space in the system
 * spent on nothing. This is what belongs there: the RAG spread, the two
 * variances that produce it, and whether delivery is speeding up or slowing
 * down.
 *
 * Every figure states its own basis. A RAG rating whose rule nobody can quote
 * is a number people quietly stop trusting, and then quietly stop using.
 */

export interface PortfolioHealthProps {
  rag: PortfolioRag;
  /** Tasks completed in each of the last six weeks, oldest first. */
  deliveryTrend: number[];
  onDrillDown?: (rag: Rag) => void;
  className?: string;
}

export function PortfolioHealth({
  rag,
  deliveryTrend,
  onDrillDown,
  className,
}: PortfolioHealthProps) {
  const needsAttention = rag.red + rag.amber;

  const segments = (
    [
      { key: 'RED' as const, count: rag.red, className: 'bg-destructive' },
      { key: 'AMBER' as const, count: rag.amber, className: 'bg-warning' },
      { key: 'GREEN' as const, count: rag.green, className: 'bg-success' },
      { key: 'COMPLETE' as const, count: rag.complete, className: 'bg-muted-foreground/40' },
    ] as const
  ).filter((s) => s.count > 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Portfolio health</CardTitle>
            <CardDescription>
              {rag.total === 0
                ? 'No projects in this selection.'
                : needsAttention === 0
                  ? `All ${rag.total} project${rag.total === 1 ? '' : 's'} on track against schedule and budget.`
                  : `${needsAttention} of ${rag.total} project${rag.total === 1 ? '' : 's'} rated amber or red.`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {rag.total > 0 && (
          <div className="space-y-3">
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Portfolio health: ${rag.red} in trouble, ${rag.amber} at risk, ${rag.green} on track, ${rag.complete} complete`}
            >
              {segments.map((segment) => (
                <div
                  key={segment.key}
                  className={cn('h-full', segment.className)}
                  style={{ width: `${(segment.count / rag.total) * 100}%` }}
                />
              ))}
            </div>

            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {(['RED', 'AMBER', 'GREEN', 'COMPLETE'] as const).map((key) => {
                const count =
                  key === 'RED'
                    ? rag.red
                    : key === 'AMBER'
                      ? rag.amber
                      : key === 'GREEN'
                        ? rag.green
                        : rag.complete;
                const interactive = onDrillDown && count > 0 && key !== 'COMPLETE';

                return (
                  <li key={key}>
                    {interactive ? (
                      <button
                        type="button"
                        onClick={() => onDrillDown!(key)}
                        className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <RagPill rag={key} />
                        <span className="font-semibold tabular-nums">{count}</span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 px-1 py-0.5 text-sm">
                        <RagPill rag={key} />
                        <span className="font-semibold tabular-nums">{count}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Variance
            label="Schedule variance"
            metric="scheduleVariance"
            value={rag.averageScheduleVariance}
            aheadHint="ahead of plan on average"
            behindHint="behind plan on average"
          />
          <Variance
            label="Budget variance"
            value={rag.averageBudgetVariance}
            aheadHint="delivery ahead of spend"
            behindHint="spend ahead of delivery"
            emptyHint="No project in this selection has a budget recorded."
          />
          <DeliveryTrend weeks={deliveryTrend} />
        </div>
      </CardContent>
    </Card>
  );
}

function Variance({
  label,
  value,
  aheadHint,
  behindHint,
  emptyHint,
  metric,
}: {
  label: string;
  value: number | null;
  aheadHint: string;
  behindHint: string;
  emptyHint?: string;
  metric?: 'scheduleVariance';
}) {
  const ahead = (value ?? 0) >= 0;
  const Icon = ahead ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {label}
        {metric && <MetricInfo metric={metric} />}
      </p>
      {value === null ? (
        <>
          <p className="mt-1 text-2xl font-bold text-muted-foreground">N/A</p>
          <p className="text-xs text-muted-foreground">
            {emptyHint ?? 'Not enough data in this selection.'}
          </p>
        </>
      ) : (
        <>
          <p
            className={cn(
              'mt-1 flex items-center gap-2 text-2xl font-bold tabular-nums',
              ahead ? 'text-success-strong' : 'text-destructive',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {ahead ? '+' : '−'}
            {Math.abs(Math.round(value))} pts
          </p>
          <p className="text-xs text-muted-foreground">{ahead ? aheadHint : behindHint}</p>
        </>
      )}
    </div>
  );
}

/**
 * Throughput over the last six weeks.
 *
 * Deliberately tasks-completed rather than "RAG last month": nothing in this
 * system records what the RAG rating *was*, so a historical comparison would
 * have to be reconstructed, and a reconstructed trend is a guess wearing a
 * chart. Completion timestamps are real, so this is real.
 */
function DeliveryTrend({ weeks }: { weeks: number[] }) {
  const safe = weeks.length === 6 ? weeks : [0, 0, 0, 0, 0, 0];
  const thisWeek = safe[5] ?? 0;
  const lastWeek = safe[4] ?? 0;
  const peak = Math.max(1, ...safe);
  const change = thisWeek - lastWeek;
  const up = change >= 0;

  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium text-muted-foreground">Delivery trend</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-bold tabular-nums">
        <Activity className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {thisWeek}
      </p>
      <p className="text-xs text-muted-foreground">
        tasks finished this week
        {lastWeek > 0 || thisWeek > 0 ? (
          <>
            {' · '}
            <span className={cn('font-medium', up ? 'text-success-strong' : 'text-destructive')}>
              {up ? '+' : '−'}
              {Math.abs(change)}
            </span>{' '}
            on last week
          </>
        ) : null}
      </p>

      {/* Six bars, labelled for a screen reader as a sentence rather than as
          six unexplained numbers. */}
      <div
        className="mt-2 flex h-8 items-end gap-1"
        role="img"
        aria-label={`Tasks completed in the last six weeks, oldest first: ${safe.join(', ')}`}
      >
        {safe.map((count, index) => (
          <div
            key={index}
            className={cn(
              'flex-1 rounded-sm',
              index === 5 ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
            style={{ height: `${Math.max(8, (count / peak) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The three things that need somebody, as counts with a way in.
 *
 * Separate from the health card because they answer a different question:
 * health is "how is the portfolio", this is "what do I do next".
 */
export function NeedsAttention({
  pendingApprovals,
  overdueTasks,
  openBlockers,
  className,
}: {
  pendingApprovals: number;
  overdueTasks: number;
  openBlockers: number;
  className?: string;
}) {
  const items = [
    {
      key: 'approvals',
      count: pendingApprovals,
      label: 'waiting on your decision',
      href: '/approvals',
      cta: 'Open the inbox',
      icon: Activity,
    },
    {
      key: 'tasks',
      count: overdueTasks,
      label: 'of your tasks are overdue',
      href: '/my-tasks',
      cta: 'See your tasks',
      icon: TrendingDown,
    },
    {
      key: 'blockers',
      count: openBlockers,
      label: 'issues open across the portfolio',
      href: '/reports?type=active-blockers',
      cta: 'See the projects',
      icon: ShieldAlert,
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) {
    return (
      <Card className={cn('border-success/30 bg-success-soft', className)}>
        <CardContent className="flex items-center gap-3 py-4">
          <RagPill rag="GREEN" />
          <div>
            <p className="font-medium text-success-strong">Nothing needs you right now</p>
            <p className="text-sm text-muted-foreground">
              No approvals waiting, no overdue tasks of your own, and no open issues.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Needs your attention</CardTitle>
        <CardDescription>Three things outstanding, each with somewhere to go.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.key}>
              <a
                href={item.href}
                className="flex h-full flex-col justify-between gap-2 rounded-lg border p-3 transition-colors hover:border-ring hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div>
                  <p className="text-2xl font-bold tabular-nums">{item.count}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
                <p className="text-sm font-medium text-primary">{item.cta} →</p>
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
