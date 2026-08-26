import type { Prisma, PrismaClient, ProjectStage } from '@prisma/client';
import { OPEN_BLOCKER_STATUSES } from '@/lib/validation/blocker';

/**
 * The rules governing a project's passage through initiation and closure.
 *
 * Kept free of Prisma queries where possible so the rules themselves can be
 * unit tested; the functions that must read the database take a client.
 */

/** Which stage may follow which. Anything absent is not a legal move. */
const ALLOWED_TRANSITIONS: Record<ProjectStage, ProjectStage[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['CLOSING', 'CANCELLED'],
  CLOSING: ['CLOSED', 'APPROVED'],
  // Terminal. Reopening a closed project is a new project, not an edit.
  CLOSED: [],
  CANCELLED: [],
};

export function canTransition(from: ProjectStage, to: ProjectStage): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionError(from: ProjectStage, to: ProjectStage): string {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (allowed.length === 0) {
    return `A ${from.toLowerCase()} project cannot change stage.`;
  }
  return `A ${from.toLowerCase()} project can only move to ${allowed
    .map((s) => s.toLowerCase())
    .join(' or ')}.`;
}

/** Stages whose projects count as live portfolio work. */
export function isInPortfolio(stage: ProjectStage): boolean {
  return stage === 'APPROVED' || stage === 'CLOSING';
}

export interface CharterCheck {
  ok: boolean;
  missing: string[];
}

/**
 * What a project needs before a sponsor can be asked to approve it.
 *
 * Projects used to be created straight into any status with none of this, so
 * the portfolio counted work nobody had agreed to and there was no record of
 * why it existed.
 */
export function checkCharter(project: {
  charter?: string | null;
  businessCase?: string | null;
  projectManagerId?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}): CharterCheck {
  const missing: string[] = [];
  if (!project.charter?.trim()) missing.push('a charter describing what the project will deliver');
  if (!project.businessCase?.trim()) missing.push('a business case');
  if (!project.projectManagerId) missing.push('a project manager');
  if (!project.startDate || !project.endDate) missing.push('a start and end date');
  return { ok: missing.length === 0, missing };
}

export interface ClosureChecklist {
  deliverablesAccepted: boolean;
  paymentsSettled: boolean;
  blockersClosed: boolean;
  handoverAcknowledged: boolean;
  lessonsLearned?: string | null;
}

export interface ClosureCheck {
  ok: boolean;
  outstanding: string[];
}

/**
 * What must be true before closure can be signed off.
 *
 * Setting a status to "Completed" used to be the whole of closure — and it
 * force-marked every task done in the process. This is the checklist that
 * replaces it.
 */
export function checkClosure(checklist: ClosureChecklist): ClosureCheck {
  const outstanding: string[] = [];
  if (!checklist.deliverablesAccepted) outstanding.push('deliverables accepted');
  if (!checklist.paymentsSettled) outstanding.push('payments settled');
  if (!checklist.blockersClosed) outstanding.push('blockers closed');
  if (!checklist.handoverAcknowledged) outstanding.push('handover acknowledged');
  if (!checklist.lessonsLearned?.trim()) outstanding.push('lessons learned recorded');
  return { ok: outstanding.length === 0, outstanding };
}

type Db = PrismaClient | Prisma.TransactionClient;

export interface ClosureReadiness {
  outstandingTasks: number;
  openBlockers: number;
  unsettledPayments: number;
}

/**
 * The facts the closure checklist is asserting, read from the data.
 *
 * Offered to whoever is closing the project so the checkboxes are a
 * confirmation rather than a guess.
 */
export async function closureReadiness(db: Db, projectId: string): Promise<ClosureReadiness> {
  const [outstandingTasks, openBlockers, unsettledPayments] = await Promise.all([
    db.task.count({
      where: {
        milestone: { projectId },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
    }),
    db.blocker.count({ where: { projectId, status: { in: [...OPEN_BLOCKER_STATUSES] } } }),
    db.payment.count({ where: { projectId, status: 'PENDING' } }),
  ]);

  return { outstandingTasks, openBlockers, unsettledPayments };
}
