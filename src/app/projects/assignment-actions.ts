'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/guard';
import { auditAction } from '@/lib/auth/audit-context';
import { AUDIT_ACTIONS } from '@/lib/audit-log';
import { serialize } from '@/lib/serialize';
import { summarizeAllocation } from '@/lib/metrics';
import { USER_SUMMARY_SELECT } from '@/lib/queries/user-select';

/**
 * Who is on a project, in what capacity, and for how much of their week.
 *
 * Separate from the team actions on purpose: a team says who works together,
 * an assignment says what a particular person owes a particular project. The
 * two were the same thing before, which is why nobody could see that the same
 * four people were on every project at once.
 */

const PROJECT_ROLES = [
  'SPONSOR',
  'PROJECT_MANAGER',
  'TEAM_LEAD',
  'MEMBER',
  'STAKEHOLDER',
] as const;

const assignmentSchema = z.object({
  userId: z.string().min(1, 'Choose a person.'),
  role: z.enum(PROJECT_ROLES),
  allocationPct: z
    .number()
    .int('Give a whole percentage.')
    .min(1, 'An assignment of zero is not an assignment; remove it instead.')
    .max(100, 'One project cannot have more than all of somebody.'),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;

export async function getProjectAssignments(projectId: string) {
  await requirePermission('projects:read');

  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId },
    include: { user: { select: USER_SUMMARY_SELECT } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  return serialize(assignments);
}

/**
 * What everyone on this project is already committed to, across all projects.
 *
 * The point of a capacity view is what a person owes *elsewhere*, so this
 * deliberately looks beyond the project being viewed.
 */
export async function getTeamCapacity(projectId: string) {
  await requirePermission('projects:read');

  const onThisProject = await prisma.projectAssignment.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const userIds = [...new Set(onThisProject.map((a) => a.userId))];
  if (userIds.length === 0) return { people: [], summaries: [] };

  const [everything, people] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        projectId: true,
        allocationPct: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: USER_SUMMARY_SELECT,
    }),
  ]);

  return {
    people: serialize(people),
    summaries: summarizeAllocation(everything),
  };
}

export async function assignToProject(projectId: string, input: AssignmentInput) {
  const actor = await requirePermission('projects:update');

  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const data = parsed.data;

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    return { success: false as const, error: 'The end date cannot be before the start date.' };
  }

  const person = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, name: true, isActive: true },
  });
  if (!person || !person.isActive) {
    return { success: false as const, error: 'That person cannot be assigned.' };
  }

  try {
    const created = await prisma.projectAssignment.create({
      data: {
        projectId,
        userId: data.userId,
        role: data.role,
        allocationPct: data.allocationPct,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
      },
    });

    await auditAction(actor, {
      action: AUDIT_ACTIONS.ASSIGNMENT_CREATED,
      entity: 'ProjectAssignment',
      entityId: created.id,
      details: {
        projectId,
        userId: data.userId,
        role: data.role,
        allocationPct: data.allocationPct,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true as const, id: created.id };
  } catch (error) {
    // The unique key is (userId, projectId, role), so this is the only way a
    // create fails once the person has been checked.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return {
        success: false as const,
        error: `${person.name} already holds that role on this project.`,
      };
    }
    console.error('Failed to assign to project:', error);
    return { success: false as const, error: 'Could not record the assignment.' };
  }
}

export async function updateAssignment(
  assignmentId: string,
  projectId: string,
  input: Pick<AssignmentInput, 'allocationPct' | 'startDate' | 'endDate'>,
) {
  const actor = await requirePermission('projects:update');

  const parsed = assignmentSchema
    .pick({ allocationPct: true, startDate: true, endDate: true })
    .safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const data = parsed.data;

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    return { success: false as const, error: 'The end date cannot be before the start date.' };
  }

  const existing = await prisma.projectAssignment.findUnique({ where: { id: assignmentId } });
  if (!existing || existing.projectId !== projectId) {
    return { success: false as const, error: 'Assignment not found.' };
  }

  await prisma.projectAssignment.update({
    where: { id: assignmentId },
    data: {
      allocationPct: data.allocationPct,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
    },
  });

  await auditAction(actor, {
    action: AUDIT_ACTIONS.ASSIGNMENT_UPDATED,
    entity: 'ProjectAssignment',
    entityId: assignmentId,
    details: {
      projectId,
      from: { allocationPct: existing.allocationPct },
      to: { allocationPct: data.allocationPct },
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true as const };
}

export async function removeAssignment(assignmentId: string, projectId: string) {
  const actor = await requirePermission('projects:update');

  const existing = await prisma.projectAssignment.findUnique({ where: { id: assignmentId } });
  if (!existing || existing.projectId !== projectId) {
    return { success: false as const, error: 'Assignment not found.' };
  }

  await prisma.projectAssignment.delete({ where: { id: assignmentId } });

  await auditAction(actor, {
    action: AUDIT_ACTIONS.ASSIGNMENT_DELETED,
    entity: 'ProjectAssignment',
    entityId: assignmentId,
    details: { projectId, userId: existing.userId, role: existing.role },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true as const };
}
