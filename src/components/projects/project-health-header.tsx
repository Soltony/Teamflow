'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CalendarClock, Flag, ShieldAlert, TrendingUp, Wallet } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RagPill } from '@/components/ui/status-pill';
import { MetricInfo } from '@/components/metrics/metric-info';
import { assessRag, displayProgress, projectProgress } from '@/lib/metrics';
import { milestoneHealth, type DatedWorkLike } from '@/lib/ui/health';
import { isOpenBlocker } from '@/lib/validation/blocker';
import { cn } from '@/lib/utils';

/**
 * The five things somebody wants before they read anything else about a
 * project: is it in trouble, how far along is it against what was promised,
 * what happens next, what is in the way, and how much of the money has gone.
 *
 * The page this replaces opened with the project's name, its description and
 * six lines of grey metadata. All true, none of it answering the question the
 * reader arrived with.
 *
 * Progress is shown against the baseline rather than on its own, because 60%
 * means nothing without knowing whether 60% is where we should be.
 */

export interface ProjectHealthHeaderProps {
  project: any;
  /** Jumps to the tab that owns a figure. */
  onNavigate?: (tab: string) => void;
  className?: string;
}

export function ProjectHealthHeader({
  project,
  onNavigate,
  className,
}: ProjectHealthHeaderProps) {
  const rag = React.useMemo(() => assessRag(project), [project]);
  const progress = projectProgress(project);

  const openBlockers = (project.blockers ?? []).filter((b: any) => isOpenBlocker(b.status));
  const seriousBlockers = openBlockers.filter(
    (b: any) => b.severity === 'HIGH' || b.severity === 'CRITICAL',
  );

  /**
   * The next milestone that is not finished, by due date.
   *
   * "Next" means the next thing to worry about, so an overdue milestone counts
   * as next — it has not happened, and it is the most urgent thing there is.
   */
  const nextMilestone = React.useMemo(() => {
    const unfinished = (project.milestones ?? [])
      .filter((m: DatedWorkLike) => milestoneHealth(m) !== 'COMPLETE')
      .slice()
      .sort(
        (a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
    return unfinished[0] ?? null;
  }, [project.milestones]);

  const elapsed = rag.scheduleVariance !== null ? progress - rag.scheduleVariance : null;

  return (
    <Card className={cn(rag.rag === 'RED' && 'border-destructive/40', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <HeaderCell
            icon={Flag}
            label="Health"
            tone={rag.rag === 'RED' ? 'critical' : rag.rag === 'AMBER' ? 'warning' : 'neutral'}
          >
            <div className="space-y-1.5">
              <RagPill rag={rag.rag} showLetter />
              {rag.reasons.length > 0 ? (
                <p className="text-xs text-muted-foreground">{rag.reasons[0]}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {rag.rag === 'COMPLETE' ? 'Delivered and closed' : 'On schedule and on budget'}
                </p>
              )}
            </div>
          </HeaderCell>

          <HeaderCell icon={TrendingUp} label="Progress vs plan" metric="progress">
            <div className="space-y-1.5">
              <p className="text-2xl font-bold tabular-nums">{displayProgress(progress)}%</p>
              <Progress
                value={progress}
                className="h-2"
                aria-label={`Progress: ${displayProgress(progress)}%`}
              />
              {elapsed !== null ? (
                <p className="text-xs text-muted-foreground">
                  {Math.round(elapsed)}% of the schedule elapsed —{' '}
                  <span
                    className={cn(
                      'font-medium',
                      rag.scheduleVariance! >= 0 ? 'text-success-strong' : 'text-destructive',
                    )}
                  >
                    {rag.scheduleVariance! >= 0 ? 'ahead' : 'behind'} by{' '}
                    {Math.abs(Math.round(rag.scheduleVariance!))} pts
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No schedule to measure against</p>
              )}
            </div>
          </HeaderCell>

          <HeaderCell icon={CalendarClock} label="Next milestone">
            {nextMilestone ? (
              <button
                type="button"
                onClick={() => onNavigate?.('schedule')}
                className="space-y-1 rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="line-clamp-2 font-semibold leading-snug">{nextMilestone.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due {format(parseISO(nextMilestone.dueDate), 'd MMM yyyy')}
                </p>
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {(project.milestones ?? []).length === 0
                  ? 'No milestones planned'
                  : 'Every milestone is complete'}
              </p>
            )}
          </HeaderCell>

          <HeaderCell
            icon={ShieldAlert}
            label="Open risks"
            tone={seriousBlockers.length > 0 ? 'critical' : openBlockers.length > 0 ? 'warning' : 'neutral'}
          >
            <button
              type="button"
              onClick={() => onNavigate?.('risks')}
              className="space-y-1 rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  seriousBlockers.length > 0 && 'text-destructive',
                )}
              >
                {openBlockers.length}
              </p>
              <p className="text-xs text-muted-foreground">
                {openBlockers.length === 0
                  ? 'Nothing is blocking delivery'
                  : `${seriousBlockers.length} high or critical`}
              </p>
            </button>
          </HeaderCell>

          <HeaderCell
            icon={Wallet}
            label="Budget used"
            tone={
              rag.budgetVariance !== null && rag.budgetVariance < -10 ? 'warning' : 'neutral'
            }
          >
            {rag.budgetUsed === null ? (
              <p className="text-sm text-muted-foreground">No budget recorded</p>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate?.('budget')}
                className="w-full space-y-1.5 rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-2xl font-bold tabular-nums">{Math.round(rag.budgetUsed)}%</p>
                <Progress
                  value={Math.min(100, rag.budgetUsed)}
                  className="h-2"
                  aria-label={`Budget used: ${Math.round(rag.budgetUsed)}%`}
                />
                <p className="text-xs text-muted-foreground">
                  {rag.budgetVariance !== null && rag.budgetVariance < 0 ? (
                    <span className="font-medium text-destructive">
                      {Math.abs(Math.round(rag.budgetVariance))} pts ahead of delivery
                    </span>
                  ) : (
                    'committed against the budget'
                  )}
                </p>
              </button>
            )}
          </HeaderCell>
        </div>

        {rag.reasons.length > 1 && (
          <p className="mt-4 flex items-start gap-2 border-t pt-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" aria-hidden="true" />
            <span>Also: {rag.reasons.slice(1).join('; ')}.</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function HeaderCell({
  icon: Icon,
  label,
  metric,
  tone = 'neutral',
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  metric?: 'progress';
  tone?: 'neutral' | 'warning' | 'critical';
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            tone === 'critical' && 'text-destructive',
            tone === 'warning' && 'text-warning-strong',
          )}
        />
        {label}
        {metric && <MetricInfo metric={metric} />}
      </p>
      {children}
    </div>
  );
}
