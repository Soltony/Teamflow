'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/guard';
import { auditAction } from '@/lib/auth/audit-context';
import { AUDIT_ACTIONS } from '@/lib/audit-log';

/**
 * Moving a milestone or a task on the timeline.
 *
 * Dragging a bar is a write, so it is guarded exactly as the edit form is —
 * `projects:update`, checked here rather than trusted from the component that
 * decided to render a draggable bar. A server action is an HTTP endpoint; a
 * permission enforced only in the browser is a suggestion.
 *
 * Two rules the drag itself cannot express:
 *
 *  - **the baseline never moves.** Moving the plan is a scheduling decision;
 *    moving the commitment is a governance one, and that goes through the
 *    timeline-change approval instead. If this wrote the baseline too, every
 *    schedule metric would quietly re-anchor to the new dates and no project
 *    could ever be reported late.
 *  - **a milestone contains its tasks.** Dragging a milestone earlier than the
 *    work inside it would produce a milestone that ends before its own tasks,
 *    so the range is clamped and the caller is told.
 */

const rescheduleSchema = z.object({
  id: z.string().min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
});

export interface RescheduleResult {
  success: boolean;
  error?: string;
}

export async function rescheduleWork(
  id: string,
  startIso: string,
  endIso: string,
): Promise<RescheduleResult> {
  const actor = await requirePermission('projects:update');

  const parsed = rescheduleSchema.safeParse({ id, start: startIso, end: endIso });
  if (!parsed.success) {
    return { success: false, error: 'Those dates were not valid.' };
  }
  const { start, end } = parsed.data;

  if (end < start) {
    return { success: false, error: 'A bar cannot end before it starts.' };
  }

  try {
    // Which is it? The id space is shared between the two on the chart, so
    // look for a task first and fall back to a milestone.
    const task = await prisma.task.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        milestone: { select: { id: true, projectId: true } },
      },
    });

    if (task) {
      await prisma.task.update({
        where: { id: task.id },
        // Baseline columns are deliberately untouched.
        data: { startDate: start, endDate: end },
      });

      await auditAction(actor, {
        action: AUDIT_ACTIONS.PROJECT_UPDATED,
        entity: 'Task',
        entityId: task.id,
        details: {
          rescheduled: true,
          title: task.title,
          from: { startDate: task.startDate, endDate: task.endDate },
          to: { startDate: start, endDate: end },
        },
      });

      revalidatePath(`/projects/${task.milestone.projectId}`);
      revalidatePath('/gantt');
      return { success: true };
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        title: true,
        startDate: true,
        dueDate: true,
        projectId: true,
        tasks: { select: { startDate: true, endDate: true } },
      },
    });

    if (!milestone) {
      return { success: false, error: 'That item no longer exists.' };
    }

    // A milestone must still contain its own work.
    if (milestone.tasks.length > 0) {
      const earliest = new Date(
        Math.min(...milestone.tasks.map((t) => new Date(t.startDate).getTime())),
      );
      const latest = new Date(
        Math.max(...milestone.tasks.map((t) => new Date(t.endDate).getTime())),
      );

      if (start > earliest || end < latest) {
        return {
          success: false,
          error:
            'That would put the milestone outside the tasks it contains. Move the tasks first, or widen the milestone rather than shifting it.',
        };
      }
    }

    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { startDate: start, dueDate: end },
    });

    await auditAction(actor, {
      action: AUDIT_ACTIONS.PROJECT_UPDATED,
      entity: 'Milestone',
      entityId: milestone.id,
      details: {
        rescheduled: true,
        title: milestone.title,
        from: { startDate: milestone.startDate, dueDate: milestone.dueDate },
        to: { startDate: start, dueDate: end },
      },
    });

    revalidatePath(`/projects/${milestone.projectId}`);
    revalidatePath('/gantt');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'The change could not be saved.',
    };
  }
}
