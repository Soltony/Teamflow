import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * The holding milestone for tasks that belong to a project rather than to any
 * particular milestone.
 *
 * This is a workaround for `Task.milestoneId` being required: a task must hang
 * off something, so "project-level" tasks are parked here. The proper fix is a
 * nullable `milestoneId` with a direct `projectId`, which is a schema change
 * worth doing on its own; until then, everything that touches this milestone
 * goes through this module so the two behaviours cannot diverge again.
 */
export const GENERAL_TASKS_TITLE = 'General Tasks';

export const GENERAL_TASKS_DESCRIPTION =
  'A default collection of tasks for this project that are not assigned to a specific milestone.';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The weight this milestone should carry: whatever the named milestones have
 * left over, or the whole 100 when there are none.
 *
 * The two creation sites previously disagreed — one used 0 and the other 100 —
 * so two projects with identical work reported different progress depending on
 * which code path happened to create the milestone. A weight of 0 was the worse
 * of the two: it excluded every project-level task from the project's progress
 * entirely.
 */
export function residualWeight(namedMilestoneWeights: number[]): number {
  const declared = namedMilestoneWeights.reduce((sum, w) => sum + (Number(w) || 0), 0);
  return Math.max(0, Math.round((100 - declared) * 1000) / 1000);
}

/**
 * Returns the project's General Tasks milestone, creating it if absent.
 *
 * Its weight is recalculated on every call, so adding a named milestone later
 * does not leave project-level work holding a stale share.
 */
export async function ensureGeneralTasksMilestone(db: Db, projectId: string): Promise<string> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      startDate: true,
      endDate: true,
      milestones: { select: { id: true, title: true, weight: true } },
    },
  });
  if (!project) throw new Error('Project not found');

  const existing = project.milestones.find((m) => m.title === GENERAL_TASKS_TITLE);
  const namedWeights = project.milestones
    .filter((m) => m.title !== GENERAL_TASKS_TITLE)
    .map((m) => m.weight);
  const weight = residualWeight(namedWeights);

  if (existing) {
    if (existing.weight !== weight) {
      await db.milestone.update({ where: { id: existing.id }, data: { weight } });
    }
    return existing.id;
  }

  const created = await db.milestone.create({
    data: {
      title: GENERAL_TASKS_TITLE,
      description: GENERAL_TASKS_DESCRIPTION,
      startDate: project.startDate,
      dueDate: project.endDate,
      weight,
      projectId,
    },
  });
  return created.id;
}

/** True for the holding milestone, which the UI presents as "project level". */
export function isGeneralTasksMilestone(milestone: { title?: string | null } | null | undefined) {
  return milestone?.title === GENERAL_TASKS_TITLE;
}
