'use client';

import * as React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * What needs doing, why, and what happens next.
 *
 * Every approval screen in this system opened with a table and a pair of
 * Approve / Reject buttons at the end of each row. Nothing on the page said
 * what approving would *do* — a task approval marks the task Done, a timeline
 * approval moves the project's deadline, a payment approval releases money —
 * and nothing said what happens to the thing if you reject it. People were
 * being asked to make a decision without being told its consequence.
 *
 * The same gap existed on task review: the Approve button sat in a card at the
 * bottom of the right-hand column, below the fold on a laptop, with no
 * indication anywhere above it that the task was waiting on you at all.
 *
 * This is the fix, in three parts that are all required:
 *
 *  - **what** — the headline: what is being asked of you.
 *  - **why** — the reason it landed with you, and what state it is in.
 *  - **next** — what will happen when you act, stated before you act.
 */

export type ActionTone = 'action' | 'waiting' | 'done' | 'info';

const TONE: Record<
  ActionTone,
  { icon: LucideIcon; container: string; icon_: string; heading: string }
> = {
  action: {
    icon: AlertTriangle,
    container: 'border-warning/40 bg-warning-soft',
    icon_: 'text-warning-strong',
    heading: 'text-warning-strong',
  },
  waiting: {
    icon: Info,
    container: 'border-border bg-muted/60',
    icon_: 'text-muted-foreground',
    heading: 'text-foreground',
  },
  done: {
    icon: CheckCircle2,
    container: 'border-success/30 bg-success-soft',
    icon_: 'text-success-strong',
    heading: 'text-success-strong',
  },
  info: {
    icon: Info,
    container: 'border-border bg-muted/60',
    icon_: 'text-muted-foreground',
    heading: 'text-foreground',
  },
};

export interface ActionRequiredProps {
  tone?: ActionTone;
  /** What is being asked. "This task is waiting for your review." */
  title: string;
  /** Why it is here and what state it is in. One or two sentences. */
  reason?: React.ReactNode;
  /**
   * What acting will do, phrased as consequence: "Approving marks the task
   * done and closes it out of the assignee's list."
   */
  nextStep?: React.ReactNode;
  /** The decision buttons. */
  actions?: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
}

export function ActionRequired({
  tone = 'action',
  title,
  reason,
  nextStep,
  actions,
  className,
  icon,
}: ActionRequiredProps) {
  const preset = TONE[tone];
  const Icon = icon ?? preset.icon;

  return (
    <div
      // An action banner is a status, not an interruption — it does not steal
      // the reader's place, but it must be announced when it appears.
      role="status"
      className={cn('rounded-lg border p-4', preset.container, className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', preset.icon_)} aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className={cn('font-semibold', preset.heading)}>{title}</p>
            {reason && <p className="text-sm text-foreground/80">{reason}</p>}
            {nextStep && (
              <p className="flex items-start gap-1.5 pt-1 text-sm text-muted-foreground">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{nextStep}</span>
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}

/**
 * The queue header on an approvals screen.
 *
 * States the size of the queue and what approving means here, once, above the
 * list — rather than leaving each row to imply it.
 */
export function ApprovalQueueIntro({
  count,
  noun,
  whatApprovalDoes,
  whatRejectionDoes,
  className,
}: {
  count: number;
  /** Singular. "task", "deadline change", "payment". */
  noun: string;
  whatApprovalDoes: string;
  whatRejectionDoes: string;
  className?: string;
}) {
  if (count === 0) {
    return (
      <ActionRequired
        tone="done"
        className={className}
        title="Nothing is waiting on you"
        reason={`There are no ${noun}s awaiting a decision. Anything submitted will appear here.`}
      />
    );
  }

  return (
    <ActionRequired
      tone="action"
      className={className}
      title={`${count} ${count === 1 ? noun : `${noun}s`} waiting for your decision`}
      reason={whatApprovalDoes}
      nextStep={whatRejectionDoes}
    />
  );
}
