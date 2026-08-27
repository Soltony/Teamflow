'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import prisma from '@/lib/db';
import { requireUser, userHasPermission } from '@/lib/auth/guard';

/**
 * Changing several tasks at once.
 *
 * Doing this one task at a time is the single most common complaint about a
 * task list: a delivery lead who has just re-planned a week has ten tasks to
 * move, and ten round trips through a dialog is most of an afternoon.
 *
 * The rules that make it safe are the same ones the single-task action
 * enforces, applied per task rather than to the batch:
 *
 *  - **you may only move your own work**, unless you hold the permission that
 *    lets you manage other people's;
 *  - **DONE and PENDING_REVIEW are not self-service.** Completion is an
 *    approval outcome. Letting a bulk edit set them would route around the
 *    entire review process, which is the one thing this system exists to
 *    enforce.
 *
 * Partial success is reported honestly. A batch where two of twelve were not
 * yours should tell you that, not fail silently or roll back the ten that were.
 */

const SELF_SERVICE_STATUSES = ['TODO', 'IN_PROGRESS'] as const;

const bulkStatusSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1).max(200),
  status: z.enum(SELF_SERVICE_STATUSES),
});

const bulkDueDateSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1).max(200),
  endDate: z.coerce.date(),
});

export interface BulkTaskResult {
  updated: number;
  skipped: number;
  /** Why the skipped ones were skipped — the first distinct reason. */
  reason?: string;
}

/** Tasks from this set that the caller is actually allowed to change. */
async function permittedTasks(taskIds: string[]) {
  const user = await requireUser();
  // One permission covers "manage other people's tasks"; without it a person
  // may only move work assigned to them.
  const managesOthers = userHasPermission(user, ['team-view:manage', 'team-view:manage-all', 'projects:update']);

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      status: true,
      milestone: { select: { projectId: true } },
      assignees: { select: { id: true } },
    },
  });

  const allowed = tasks.filter(
    (task) => managesOthers || task.assignees.some((a) => a.id === user.id),
  );

  return { tasks, allowed, managesOthers };
}

export async function bulkUpdateTaskStatus(input: unknown): Promise<BulkTaskResult> {
  const parsed = bulkStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { updated: 0, skipped: 0, reason: 'That request was not valid.' };
  }

  const { tasks, allowed } = await permittedTasks(parsed.data.taskIds);

  // A task already approved is not reopened by a bulk edit. Reopening finished
  // work is a deliberate act, and it belongs on the task itself where the
  // reason can be recorded.
  const movable = allowed.filter((t) => t.status !== 'DONE');

  if (movable.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: movable.map((t) => t.id) } },
      data: {
        status: parsed.data.status,
        completedAt: null,
        // Moving back to To do resets progress, matching the single-task
        // rule; moving to In progress leaves whatever was reported.
        ...(parsed.data.status === 'TODO' ? { progress: 0 } : {}),
      },
    });
  }

  for (const projectId of new Set(movable.map((t) => t.milestone.projectId))) {
    revalidatePath(`/projects/${projectId}`);
  }
  revalidatePath('/my-tasks');
  revalidatePath('/team-view');

  const skipped = tasks.length - movable.length;
  return {
    updated: movable.length,
    skipped,
    reason:
      skipped === 0
        ? undefined
        : allowed.length < tasks.length
          ? 'Some of those are not assigned to you.'
          : 'Completed tasks cannot be moved in bulk — reopen them individually.',
  };
}

export async function bulkUpdateTaskDueDate(input: unknown): Promise<BulkTaskResult> {
  const parsed = bulkDueDateSchema.safeParse(input);
  if (!parsed.success) {
    return { updated: 0, skipped: 0, reason: 'That date was not valid.' };
  }

  const { tasks, allowed } = await permittedTasks(parsed.data.taskIds);
  const movable = allowed.filter((t) => t.status !== 'DONE');

  if (movable.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: movable.map((t) => t.id) } },
      // The baseline is deliberately untouched: moving a due date changes the
      // plan, not what was committed to.
      data: { endDate: parsed.data.endDate },
    });
  }

  for (const projectId of new Set(movable.map((t) => t.milestone.projectId))) {
    revalidatePath(`/projects/${projectId}`);
  }
  revalidatePath('/my-tasks');
  revalidatePath('/team-view');

  const skipped = tasks.length - movable.length;
  return {
    updated: movable.length,
    skipped,
    reason:
      skipped === 0
        ? undefined
        : allowed.length < tasks.length
          ? 'Some of those are not assigned to you.'
          : 'Completed tasks keep the date they were finished against.',
  };
}
