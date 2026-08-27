'use server';

import prisma from '@/lib/db';

import { requireUser, userHasPermission } from '@/lib/auth/guard';
import { getNumber } from '@/lib/settings';
import {
  APPROVAL_KIND_PERMISSION,
  APPROVAL_KIND_VIEW_PERMISSION,
  type ApprovalItem,
  type ApprovalKind,
  type SlaThresholds,
} from '@/lib/approvals/types';
import { OPEN_BLOCKER_STATUSES } from '@/lib/validation/blocker';

// Re-exported through the page rather than from here: this file carries
// 'use server', so it may only export async functions.

const money = (amount: unknown, currency?: string | null) => {
  const symbol = currency === 'USD' ? '$' : 'ETB';
  const value = Number(String(amount ?? 0)) || 0;
  return `${symbol} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const isoOf = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const dateLabel = (value: Date | string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Everything waiting on this person, across all three kinds.
 *
 * One query per kind rather than one clever union: the three live in different
 * tables with different shapes, and the mapping to a common item is where the
 * value is, not the fetching. Each kind is skipped entirely when the reader
 * cannot see it, so a payments approver does not pay for a task query.
 */
export async function getApprovalInbox(): Promise<{
  items: ApprovalItem[];
  thresholds: SlaThresholds;
  visibleKinds: ApprovalKind[];
}> {
  const user = await requireUser();

  const canView = (kind: ApprovalKind) =>
    userHasPermission(user, APPROVAL_KIND_VIEW_PERMISSION[kind]);
  const canDecide = (kind: ApprovalKind) =>
    userHasPermission(user, APPROVAL_KIND_PERMISSION[kind]);

  const visibleKinds = (['task', 'timeline', 'payment'] as ApprovalKind[]).filter(canView);

  // getNumber rather than getSetting: it clamps to the definition's bounds, so
  // a value edited directly in the database cannot switch the SLA off.
  const [slaDays, warningDays] = await Promise.all([
    getNumber('governance.approvalSlaDays'),
    getNumber('governance.approvalSlaWarningDays'),
  ]);
  const thresholds: SlaThresholds = { slaDays, warningDays };

  const [tasks, timelines, payments] = await Promise.all([
    canView('task')
      ? prisma.task.findMany({
          where: { status: 'PENDING_REVIEW' },
          include: {
            assignees: { select: { id: true, name: true } },
            milestone: {
              select: {
                title: true,
                project: { select: { id: true, name: true } },
              },
            },
            updates: {
              where: { type: 'COMMENT' },
              orderBy: { createdAt: 'desc' },
              take: 2,
              select: { text: true, progressPercentage: true, createdAt: true },
            },
          },
          orderBy: { updatedAt: 'asc' },
        })
      : Promise.resolve([]),

    canView('timeline')
      ? prisma.timelineChangeRequest.findMany({
          where: { status: 'PENDING' },
          include: {
            project: { select: { id: true, name: true } },
            requestedBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),

    canView('payment')
      ? prisma.payment.findMany({
          where: { status: 'PENDING' },
          include: {
            project: { select: { id: true, name: true, currency: true, totalCost: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const items: ApprovalItem[] = [];

  for (const task of tasks) {
    const assignees = task.assignees.map((a) => a.name).filter(Boolean).join(', ');
    // The last comment is the claim being reviewed; the one before it gives
    // the progress the work moved *from*, which is what a reviewer checks.
    const latest = task.updates[0];
    const previous = task.updates[1];

    items.push({
      id: `task:${task.id}`,
      kind: 'task',
      entityId: task.id,
      title: task.title,
      projectId: task.milestone.project.id,
      projectName: task.milestone.project.name,
      requestedByName: assignees || null,
      // A task enters the queue when it was last moved into review.
      submittedAt: isoOf(task.updatedAt),
      rationale: latest?.text ?? null,
      facts: [
        { label: 'Milestone', value: task.milestone.title },
        {
          label: 'Progress claimed',
          value: `${task.progress}%`,
          from:
            previous?.progressPercentage != null && previous.progressPercentage !== task.progress
              ? `${previous.progressPercentage}%`
              : undefined,
        },
        { label: 'Due', value: dateLabel(task.endDate) },
        { label: 'Weight in milestone', value: `${task.weight}%` },
      ],
      approveEffect:
        'Marks the task done, closes it out of its assignees’ lists, and counts its weight towards the milestone.',
      rejectEffect:
        'Returns the task to In progress with your reason attached, so the assignees can see what to fix.',
      href: `/tasks/${task.id}`,
      canDecide: canDecide('task'),
      amount: null,
      currency: null,
    });
  }

  for (const request of timelines) {
    const slip = Math.round(
      (new Date(request.newEndDate).getTime() - new Date(request.oldEndDate).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    items.push({
      id: `timeline:${request.id}`,
      kind: 'timeline',
      entityId: request.id,
      title: `Move the deadline by ${Math.abs(slip)} day${Math.abs(slip) === 1 ? '' : 's'}`,
      projectId: request.project.id,
      projectName: request.project.name,
      requestedByName: request.requestedBy?.name ?? null,
      submittedAt: isoOf(request.createdAt),
      rationale: request.reason,
      facts: [
        {
          label: 'Deadline',
          value: dateLabel(request.newEndDate),
          from: dateLabel(request.oldEndDate),
        },
        {
          label: 'Change',
          value:
            slip > 0
              ? `${slip} days later`
              : slip < 0
                ? `${Math.abs(slip)} days earlier`
                : 'No change in days',
        },
      ],
      approveEffect:
        'Rewrites the project’s end date. The original commitment stays on record as the baseline, so reporting still measures against what was first agreed.',
      rejectEffect:
        'Leaves the current deadline in place and sends your reason back to whoever asked.',
      href: `/projects/${request.project.id}?tab=schedule`,
      canDecide: canDecide('timeline'),
      amount: null,
      currency: null,
    });
  }

  for (const payment of payments) {
    const amount = Number(String(payment.amount ?? 0)) || 0;
    const budget = Number(String(payment.project?.totalCost ?? 0)) || 0;

    items.push({
      id: `payment:${payment.id}`,
      kind: 'payment',
      entityId: payment.id,
      title: payment.title,
      projectId: payment.project.id,
      projectName: payment.project.name,
      requestedByName: null,
      submittedAt: isoOf(payment.createdAt),
      rationale: payment.description ?? null,
      facts: [
        { label: 'Amount', value: money(amount, payment.project.currency) },
        {
          label: 'Share of budget',
          value: budget > 0 ? `${((amount / budget) * 100).toFixed(1)}%` : 'No budget recorded',
        },
        { label: 'Scheduled for', value: dateLabel(payment.paymentDate) },
      ],
      approveEffect:
        'Releases the payment for processing and records it against the project’s committed spend.',
      rejectEffect:
        'Releases nothing. The payment stays on the project’s schedule and your reason goes back to whoever raised it.',
      href: `/projects/${payment.project.id}?tab=budget`,
      canDecide: canDecide('payment'),
      amount,
      currency: payment.project.currency ?? 'ETB',
    });
  }

  return { items, thresholds, visibleKinds };
}

/**
 * How many decisions are waiting, for the sidebar badge.
 *
 * Counts only what this person may actually decide — a badge that includes
 * items somebody cannot act on sends them to a page where nothing is
 * actionable. Three counts rather than the full fetch, so the number on every
 * page load costs almost nothing.
 */
export async function getPendingApprovalCount(): Promise<number> {
  const user = await requireUser();

  const [tasks, timelines, payments] = await Promise.all([
    userHasPermission(user, APPROVAL_KIND_PERMISSION.task)
      ? prisma.task.count({ where: { status: 'PENDING_REVIEW' } })
      : Promise.resolve(0),
    userHasPermission(user, APPROVAL_KIND_PERMISSION.timeline)
      ? prisma.timelineChangeRequest.count({ where: { status: 'PENDING' } })
      : Promise.resolve(0),
    userHasPermission(user, APPROVAL_KIND_PERMISSION.payment)
      ? prisma.payment.count({ where: { status: 'PENDING' } })
      : Promise.resolve(0),
  ]);

  return tasks + timelines + payments;
}

/**
 * The counts behind "needs your attention" on the dashboard.
 *
 * Kept beside the inbox because they answer the same question — what is
 * outstanding — and reading them from two places is how two screens end up
 * disagreeing about how much work there is.
 */
export async function getAttentionCounts(): Promise<{
  pendingApprovals: number;
  overdueTasks: number;
  openBlockers: number;
}> {
  const user = await requireUser();
  const now = new Date();

  const [pendingApprovals, overdueTasks, openBlockers] = await Promise.all([
    getPendingApprovalCount(),
    prisma.task.count({
      where: {
        status: { notIn: ['DONE', 'CANCELLED'] },
        endDate: { lt: now },
        assignees: { some: { id: user.id } },
      },
    }),
    prisma.blocker.count({
      where: { status: { in: [...OPEN_BLOCKER_STATUSES] } },
    }),
  ]);

  return { pendingApprovals, overdueTasks, openBlockers };
}
