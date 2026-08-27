'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Layers,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard, StatCardGrid } from '@/components/ui/stat-card';
import { RISK_CLASS, RISK_ICON } from '@/components/ui/status-pill';
import { displayProgress, projectProgress } from '@/lib/metrics';
import { isOpenBlocker } from '@/lib/validation/blocker';
import {
  daysUntil,
  projectRisks,
  summarizeMilestoneHealth,
  type RiskIndicator,
} from '@/lib/ui/health';
import { cn } from '@/lib/utils';

/**
 * The four numbers somebody opening a project actually wants, and the reasons
 * to worry about it.
 *
 * The page used to lead with a card containing the project's name, its
 * description, six lines of metadata in a grey 14px grid, and one progress bar.
 * A reader had to infer the state of the project from a percentage — which, on
 * its own, says nothing about whether that percentage is good news in week two
 * or a disaster in the final week.
 *
 * Each card here pairs a figure with the fact that makes it mean something:
 * progress against elapsed schedule, milestones against their health, issues
 * against how many are serious.
 */

export interface ProjectSummaryProps {
  project: any;
  /** Jumps the reader to the section that owns a risk. */
  onNavigate?: (section: string) => void;
  className?: string;
}

export function ProjectSummaryCards({ project, className }: { project: any; className?: string }) {
  const progress = projectProgress(project);
  const health = summarizeMilestoneHealth(project.milestones ?? []);
  const blockers = project.blockers ?? [];
  const openBlockers = blockers.filter((b: any) => isOpenBlocker(b.status));
  const seriousBlockers = openBlockers.filter(
    (b: any) => b.severity === 'HIGH' || b.severity === 'CRITICAL',
  );

  const remaining = daysUntil({ endDate: project.endDate });
  const needsAttention = health.overdue + health.atRisk;

  return (
    <StatCardGrid className={className}>
      <StatCard
        label="Overall progress"
        metric="progress"
        icon={TrendingUp}
        value={`${displayProgress(progress)}%`}
        progress={progress}
        hint={
          health.total > 0
            ? `${health.complete} of ${health.total} milestones complete`
            : 'No milestones planned yet'
        }
        interactive={false}
      />

      <StatCard
        label="Schedule"
        icon={CalendarClock}
        tone={remaining === null ? 'neutral' : remaining < 0 ? 'critical' : remaining <= 7 ? 'warning' : 'neutral'}
        value={
          remaining === null
            ? '—'
            : remaining < 0
              ? `${Math.abs(remaining)} days over`
              : `${remaining} days left`
        }
        hint={
          project.endDate ? `Due ${format(parseISO(project.endDate), 'd MMM yyyy')}` : 'No deadline set'
        }
        interactive={false}
      />

      <StatCard
        label="Milestone health"
        icon={Layers}
        tone={health.overdue > 0 ? 'critical' : health.atRisk > 0 ? 'warning' : 'positive'}
        value={needsAttention > 0 ? `${needsAttention} need attention` : 'All on track'}
        hint={
          health.total === 0
            ? 'Nothing to track yet'
            : `${health.overdue} overdue · ${health.atRisk} behind · ${health.onTrack + health.complete} healthy`
        }
        interactive={false}
      />

      <StatCard
        label="Open issues"
        metric="blockers"
        icon={ShieldAlert}
        tone={seriousBlockers.length > 0 ? 'critical' : openBlockers.length > 0 ? 'warning' : 'positive'}
        value={openBlockers.length}
        hint={
          openBlockers.length === 0
            ? 'Nothing is blocking this project'
            : `${seriousBlockers.length} high or critical`
        }
        interactive={false}
      />
    </StatCardGrid>
  );
}

/**
 * Why this project might not land, worst first.
 *
 * Deliberately shows a positive result too. A panel that only appears when
 * something is wrong leaves a reader unable to tell "nothing is wrong" from
 * "nobody checked", and the second is the assumption people default to.
 */
export function ProjectRiskPanel({ project, onNavigate, className }: ProjectSummaryProps) {
  const risks = React.useMemo(() => projectRisks(project), [project]);

  if (risks.length === 0) {
    return (
      <Card className={cn('border-success/30 bg-success-soft', className)}>
        <CardContent className="flex items-center gap-3 py-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-success-strong" aria-hidden="true" />
          <div>
            <p className="font-medium text-success-strong">No risks flagged</p>
            <p className="text-sm text-muted-foreground">
              The schedule, the milestones and the issue register all look healthy.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const critical = risks.filter((r) => r.severity === 'critical').length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle
            className={cn('h-4 w-4', critical > 0 ? 'text-destructive' : 'text-warning-strong')}
            aria-hidden="true"
          />
          Risk indicators
          <span className="text-sm font-normal text-muted-foreground">
            ({risks.length} flagged{critical > 0 ? `, ${critical} critical` : ''})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {risks.map((risk) => (
            <RiskRow key={risk.id} risk={risk} onNavigate={onNavigate} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RiskRow({
  risk,
  onNavigate,
}: {
  risk: RiskIndicator;
  onNavigate?: (section: string) => void;
}) {
  const Icon = RISK_ICON[risk.severity];
  const canNavigate = Boolean(risk.section && onNavigate);

  const body = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-medium">{risk.label}</span>
        <span className="block text-xs font-normal opacity-90">{risk.detail}</span>
      </span>
    </>
  );

  return (
    <li>
      {canNavigate ? (
        <button
          type="button"
          onClick={() => onNavigate!(risk.section!)}
          className={cn(
            'flex w-full items-start gap-2 rounded-md border p-3 text-left text-sm transition-colors hover:brightness-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            RISK_CLASS[risk.severity],
          )}
        >
          {body}
        </button>
      ) : (
        <div
          className={cn(
            'flex w-full items-start gap-2 rounded-md border p-3 text-left text-sm',
            RISK_CLASS[risk.severity],
          )}
        >
          {body}
        </div>
      )}
    </li>
  );
}

/**
 * The compact version, for a card in a list.
 *
 * One line, worst risk only — enough to decide whether to open the project,
 * not enough to be a second summary.
 */
export function ProjectRiskBadge({ project }: { project: any }) {
  const risk = projectRisks(project)[0];
  if (!risk) return null;

  const Icon = RISK_ICON[risk.severity];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        RISK_CLASS[risk.severity],
      )}
      title={risk.detail}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {risk.label}
    </span>
  );
}

/** A green tick, for the same slot when nothing is wrong. */
export function ProjectHealthyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-xs font-medium text-success-strong">
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      On track
    </span>
  );
}
