'use server';

import { revalidatePath } from 'next/cache';

import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/guard';
import { auditAction } from '@/lib/auth/audit-context';
import { AUDIT_ACTIONS } from '@/lib/audit-log';
import {
  canTransition,
  checkCharter,
  checkClosure,
  closureReadiness,
  transitionError,
} from '@/lib/services/lifecycle';
import { serialize } from '@/lib/serialize';

/**
 * The initiation and closure gates.
 *
 * Projects previously appeared in the portfolio the moment someone filled in a
 * form, and "finished" the moment someone picked a status from a dropdown.
 * These actions put a decision at each end.
 */

type Result<T extends object = Record<never, never>> =
  | ({ success: true } & T)
  | { success: false; error: string };

/** Submits a draft for a sponsor's decision. */
export async function submitProjectForApproval(projectId: string): Promise<Result> {
  const actor = await requirePermission('projects:update');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { success: false, error: 'Project not found.' };

  if (!canTransition(project.stage, 'SUBMITTED')) {
    return { success: false, error: transitionError(project.stage, 'SUBMITTED') };
  }

  const charter = checkCharter(project);
  if (!charter.ok) {
    return {
      success: false,
      error: `Before submitting, this project needs ${charter.missing.join(', ')}.`,
    };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { stage: 'SUBMITTED', submittedAt: new Date(), submittedById: actor.id },
  });

  await auditAction(actor, {
    action: AUDIT_ACTIONS.PROJECT_UPDATED,
    entity: 'Project',
    entityId: projectId,
    details: { stage: { from: project.stage, to: 'SUBMITTED' } },
  });

  revalidatePath('/projects');
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * A sponsor admits the project to the portfolio.
 *
 * Approval is also the moment the baseline is captured: from here, every
 * schedule metric is measured against these dates.
 */
export async function approveProjectInitiation(
  projectId: string,
  notes?: string,
): Promise<Result> {
  const actor = await requirePermission('projects:create');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { success: false, error: 'Project not found.' };

  if (!canTransition(project.stage, 'APPROVED')) {
    return { success: false, error: transitionError(project.stage, 'APPROVED') };
  }
  if (project.submittedById === actor.id) {
    return { success: false, error: 'You cannot approve a project you submitted yourself.' };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      stage: 'APPROVED',
      approvedAt: new Date(),
      approvedById: actor.id,
      initiationNotes: notes?.trim() || null,
      // The commitment the project will be judged against.
      baselineStartDate: project.baselineStartDate ?? project.startDate,
      baselineEndDate: project.baselineEndDate ?? project.endDate,
      baselineSetAt: project.baselineSetAt ?? new Date(),
    },
  });

  await auditAction(actor, {
    action: AUDIT_ACTIONS.PROJECT_UPDATED,
    entity: 'Project',
    entityId: projectId,
    details: {
      stage: { from: project.stage, to: 'APPROVED' },
      baselineEndDate: project.baselineEndDate ?? project.endDate,
      notes,
    },
  });

  revalidatePath('/projects');
  revalidatePath('/dashboard');
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/** Sends a submitted project back for more work. */
export async function returnProjectToDraft(projectId: string, reason: string): Promise<Result> {
  const actor = await requirePermission('projects:create');

  if (!reason?.trim() || reason.trim().length < 10) {
    return { success: false, error: 'Give a reason of at least 10 characters.' };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { success: false, error: 'Project not found.' };
  if (!canTransition(project.stage, 'DRAFT')) {
    return { success: false, error: transitionError(project.stage, 'DRAFT') };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { stage: 'DRAFT', initiationNotes: reason.trim() },
  });

  await auditAction(actor, {
    action: AUDIT_ACTIONS.PROJECT_UPDATED,
    entity: 'Project',
    entityId: projectId,
    details: { stage: { from: project.stage, to: 'DRAFT' }, reason },
  });

  revalidatePath('/projects');
  return { success: true };
}

/** Begins closure, creating the checklist and reporting what is outstanding. */
export async function beginProjectClosure(projectId: string): Promise<
  Result<{ readiness: Awaited<ReturnType<typeof closureReadiness>> }>
> {
  const actor = await requirePermission('projects:update');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { success: false, error: 'Project not found.' };
  if (!canTransition(project.stage, 'CLOSING')) {
    return { success: false, error: transitionError(project.stage, 'CLOSING') };
  }

  const readiness = await closureReadiness(prisma, projectId);

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { stage: 'CLOSING' } });
    await tx.projectClosure.upsert({
      where: { projectId },
      update: {},
      create: { projectId },
    });
  });

  await auditAction(actor, {
    action: AUDIT_ACTIONS.PROJECT_UPDATED,
    entity: 'Project',
    entityId: projectId,
    details: { stage: { from: project.stage, to: 'CLOSING' }, readiness },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, readiness };
}

export interface ClosureInput {
  deliverablesAccepted: boolean;
  paymentsSettled: boolean;
  blockersClosed: boolean;
  handoverAcknowledged: boolean;
  handoverRecipient?: string;
  lessonsLearned: string;
}

/**
 * Signs off closure.
 *
 * Refuses while work is genuinely outstanding rather than force-marking it
 * done, which is what the old "set the status to Completed" path did — it
 * overwrote real completion dates and corrupted every on-time figure.
 */
export async function signOffProjectClosure(
  projectId: string,
  input: ClosureInput,
): Promise<Result> {
  const actor = await requirePermission('projects:update');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { success: false, error: 'Project not found.' };
  if (!canTransition(project.stage, 'CLOSED')) {
    return { success: false, error: transitionError(project.stage, 'CLOSED') };
  }

  const checklist = checkClosure(input);
  if (!checklist.ok) {
    return {
      success: false,
      error: `Closure needs: ${checklist.outstanding.join(', ')}.`,
    };
  }

  const readiness = await closureReadiness(prisma, projectId);
  if (readiness.outstandingTasks > 0) {
    return {
      success: false,
      error: `${readiness.outstandingTasks} task(s) are still open. Complete or cancel them before closing.`,
    };
  }
  if (readiness.openBlockers > 0) {
    return {
      success: false,
      error: `${readiness.openBlockers} blocker(s) are still open.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectClosure.upsert({
      where: { projectId },
      create: {
        projectId,
        ...input,
        handoverRecipient: input.handoverRecipient?.trim() || null,
        signedOffAt: new Date(),
        signedOffById: actor.id,
      },
      update: {
        ...input,
        handoverRecipient: input.handoverRecipient?.trim() || null,
        signedOffAt: new Date(),
        signedOffById: actor.id,
      },
    });
    await tx.project.update({ where: { id: projectId }, data: { stage: 'CLOSED' } });
  });

  await auditAction(actor, {
    action: AUDIT_ACTIONS.PROJECT_UPDATED,
    entity: 'Project',
    entityId: projectId,
    details: {
      stage: { from: project.stage, to: 'CLOSED' },
      handoverRecipient: input.handoverRecipient,
      lessonsLearned: input.lessonsLearned,
    },
  });

  revalidatePath('/projects');
  revalidatePath('/archive');
  revalidatePath('/dashboard');
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/** Reads the closure checklist and what the data says about it. */
export async function getProjectClosure(projectId: string) {
  await requirePermission('projects:read');

  const [closure, readiness, project] = await Promise.all([
    prisma.projectClosure.findUnique({ where: { projectId } }),
    closureReadiness(prisma, projectId),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { stage: true, name: true },
    }),
  ]);

  return serialize({ closure, readiness, project });
}
