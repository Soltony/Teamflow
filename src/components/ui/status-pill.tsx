'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  CircleSlash,
  Clock,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Health, RiskSeverity } from '@/lib/ui/health';
import type { Rag } from '@/lib/metrics/rag';
import type { SlaState } from '@/lib/approvals/types';

/**
 * One vocabulary for "how is this going", used on every screen.
 *
 * Task status was rendered in at least four places with hand-written colour
 * classes, and they did not agree: In Progress was `bg-blue-500` on the project
 * page and a plain outline badge on the dashboard, so the same task looked like
 * two different things depending on where you saw it. Worse, colour was doing
 * all the work — a red badge and a green badge were the same shape with the
 * same weight, which is invisible to anyone who cannot separate the two hues.
 *
 * Every pill here carries an icon as well as a colour, so the state survives
 * being printed in greyscale or read by somebody with a colour deficiency.
 */

const HEALTH_PRESET: Record<Health, { label: string; icon: LucideIcon; className: string }> = {
  COMPLETE: {
    label: 'Complete',
    icon: CheckCircle2,
    className: 'border-green-700/30 bg-green-700/10 text-green-800',
  },
  ON_TRACK: {
    label: 'On track',
    icon: CircleDot,
    className: 'border-green-700/30 bg-green-700/10 text-green-800',
  },
  AT_RISK: {
    label: 'Behind schedule',
    icon: AlertTriangle,
    className: 'border-amber-600/40 bg-amber-500/15 text-amber-800',
  },
  OVERDUE: {
    label: 'Overdue',
    icon: Clock,
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  NOT_STARTED: {
    label: 'Not started',
    icon: CircleDashed,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

export function HealthPill({
  health,
  className,
  label,
}: {
  health: Health;
  className?: string;
  /** Overrides the standard wording — e.g. "3 days late" instead of "Overdue". */
  label?: string;
}) {
  const preset = HEALTH_PRESET[health];
  const Icon = preset.icon;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap font-medium', preset.className, className)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label ?? preset.label}
    </Badge>
  );
}

/**
 * Task status.
 *
 * The four values the schema allows, rendered identically wherever a task
 * appears. `PENDING_REVIEW` reads "Awaiting review" rather than "Pending
 * Review" because the person looking at it usually wants to know that the ball
 * is in somebody else's court.
 */
const TASK_PRESET: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  TODO: {
    label: 'To do',
    icon: CircleDashed,
    className: 'border-border bg-muted text-muted-foreground',
  },
  IN_PROGRESS: {
    label: 'In progress',
    icon: CircleDot,
    className: 'border-blue-700/30 bg-blue-700/10 text-blue-800',
  },
  PENDING_REVIEW: {
    label: 'Awaiting review',
    icon: Clock,
    className: 'border-amber-600/40 bg-amber-500/15 text-amber-800',
  },
  DONE: {
    label: 'Done',
    icon: CheckCircle2,
    className: 'border-green-700/30 bg-green-700/10 text-green-800',
  },
  // Work that will not be done. Deliberately grey rather than red: it is a
  // decision somebody made, not a failure.
  CANCELLED: {
    label: 'Cancelled',
    icon: CircleSlash,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

export function TaskStatusPill({ status, className }: { status: string; className?: string }) {
  const preset = TASK_PRESET[status] ?? {
    label: String(status ?? 'Unknown').replace(/_/g, ' '),
    icon: CircleDashed,
    className: 'border-border bg-muted text-muted-foreground',
  };
  const Icon = preset.icon;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap font-medium', preset.className, className)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {preset.label}
    </Badge>
  );
}

/** Approval outcomes — timeline changes, payments, task reviews. */
const DECISION_PRESET: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  PENDING: {
    label: 'Awaiting decision',
    icon: Clock,
    className: 'border-amber-600/40 bg-amber-500/15 text-amber-800',
  },
  APPROVED: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'border-green-700/30 bg-green-700/10 text-green-800',
  },
  REJECTED: {
    label: 'Rejected',
    icon: AlertTriangle,
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
};

export function DecisionPill({ status, className }: { status: string; className?: string }) {
  const preset = DECISION_PRESET[status] ?? {
    label: String(status ?? 'Unknown'),
    icon: CircleDashed,
    className: 'border-border bg-muted text-muted-foreground',
  };
  const Icon = preset.icon;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap font-medium', preset.className, className)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {preset.label}
    </Badge>
  );
}

/**
 * How long a decision has been waiting, against the service level.
 *
 * Carries the number of days as well as the state, because "Breached" alone
 * invites the question the reader then has to go and answer. Icon plus text
 * plus colour, so a breach is still a breach in greyscale.
 */
const SLA_PRESET: Record<
  SlaState,
  { label: string; icon: LucideIcon; className: string }
> = {
  ON_TIME: {
    label: 'On time',
    icon: CircleDot,
    className: 'border-border bg-muted text-muted-foreground',
  },
  DUE_SOON: {
    label: 'Due soon',
    icon: Clock,
    className: 'border-amber-600/40 bg-amber-500/15 text-amber-800',
  },
  BREACHED: {
    label: 'Overdue',
    icon: AlertTriangle,
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
};

export function SlaPill({
  state,
  days,
  className,
}: {
  state: SlaState;
  /** Whole days waited, so the pill can say "waiting 6 days" rather than a mood. */
  days: number;
  className?: string;
}) {
  const preset = SLA_PRESET[state];
  const Icon = preset.icon;
  const waited = `${days} day${days === 1 ? '' : 's'}`;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap font-medium', preset.className, className)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {state === 'ON_TIME' ? `Waiting ${waited}` : `${preset.label} · ${waited}`}
    </Badge>
  );
}

/**
 * A project's RAG status.
 *
 * The letter is not enough on its own — "amber" means nothing to somebody who
 * cannot separate it from green — so each carries a word and a distinct icon.
 */
const RAG_PRESET: Record<Rag, { label: string; icon: LucideIcon; className: string }> = {
  GREEN: {
    label: 'On track',
    icon: CircleDot,
    className: 'border-green-700/30 bg-green-700/10 text-green-800',
  },
  AMBER: {
    label: 'At risk',
    icon: AlertTriangle,
    className: 'border-amber-600/40 bg-amber-500/15 text-amber-800',
  },
  RED: {
    label: 'In trouble',
    icon: AlertTriangle,
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  COMPLETE: {
    label: 'Complete',
    icon: CheckCircle2,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

export function RagPill({
  rag,
  className,
  showLetter = false,
}: {
  rag: Rag;
  className?: string;
  /** Adds the R/A/G letter for readers who report in those terms. */
  showLetter?: boolean;
}) {
  const preset = RAG_PRESET[rag];
  const Icon = preset.icon;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap font-medium', preset.className, className)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {showLetter && rag !== 'COMPLETE' ? `${rag[0]} · ${preset.label}` : preset.label}
    </Badge>
  );
}

export const RISK_CLASS: Record<RiskSeverity, string> = {
  critical: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-amber-600/40 bg-amber-500/15 text-amber-800',
  info: 'border-border bg-muted text-muted-foreground',
};

export const RISK_ICON: Record<RiskSeverity, LucideIcon> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: CircleDot,
};
