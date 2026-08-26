import prisma from '@/lib/db';
import { canSeeAllProjects } from '@/lib/auth/access';
import type { SessionUser } from '@/lib/auth/session';
import { serialize } from '@/lib/serialize';
import { USER_DISPLAY_SELECT } from '@/lib/queries/user-select';

/**
 * "What happened in this period" — the data behind both the Today and the
 * Weekly view.
 *
 * Those two pages shipped byte-identical 162-line action files differing only
 * in whether the window was a day or a week, which meant every fix had to be
 * made twice and the two drifted. The window is now a parameter.
 */

export interface ActivityPeriod {
  start: Date;
  end: Date;
}

export interface ActivityStats {
  projectsActive: number;
  tasksWithActivity: number;
  tasksRemaining: number;
  tasksCompleted: number;
}

/**
 * Restricts the query to projects this user may see.
 *
 * Someone with portfolio-wide visibility gets an empty clause; everyone else
 * sees only projects they manage, are on a team for, or hold a task in.
 */
function visibleProjectsClause(user: SessionUser) {
  if (canSeeAllProjects(user)) return {};

  return {
    OR: [
      { projectManagerId: user.id },
      { teams: { some: { members: { some: { id: user.id } } } } },
      { milestones: { some: { tasks: { some: { assignees: { some: { id: user.id } } } } } } },
    ],
  };
}

/**
 * Tasks that are due, were completed, or were updated inside the window,
 * grouped by project.
 */
export async function getActivityForPeriod(user: SessionUser, period: ActivityPeriod) {
  const { start, end } = period;

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        { milestone: { project: visibleProjectsClause(user) } },
        {
          OR: [
            { endDate: { gte: start, lte: end } },
            { completedAt: { gte: start, lte: end } },
            { updates: { some: { createdAt: { gte: start, lte: end } } } },
          ],
        },
      ],
    },
    include: {
      assignees: { select: USER_DISPLAY_SELECT },
      milestone: {
        include: {
          project: {
            include: {
              status: true,
              projectManager: { select: USER_DISPLAY_SELECT },
              pmoDivision: true,
              milestones: { include: { tasks: true } },
            },
          },
        },
      },
      updates: {
        include: { author: { select: USER_DISPLAY_SELECT } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { milestone: { project: { name: 'asc' } } },
  });

  const projectsMap = new Map<string, any>();
  for (const task of tasks) {
    const project = task.milestone.project;
    if (!projectsMap.has(project.id)) {
      projectsMap.set(project.id, {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        projectManager: project.projectManager,
        pmoDivision: project.pmoDivision,
        startDate: project.startDate,
        endDate: project.endDate,
        milestones: project.milestones,
        tasks: [],
      });
    }
    projectsMap.get(project.id).tasks.push(task);
  }

  // Only the fields these views render; the full user records, including
  // everyone's contact details, used to be sent to the browser.
  const users = await prisma.user.findMany({
    select: { id: true, name: true, avatar: true, email: true },
  });

  const stats: ActivityStats = {
    projectsActive: projectsMap.size,
    tasksWithActivity: tasks.length,
    tasksRemaining: tasks.filter((t) => t.status !== 'DONE').length,
    tasksCompleted: tasks.filter(
      (t) => t.completedAt && t.completedAt >= start && t.completedAt <= end,
    ).length,
  };

  return {
    projects: serialize(Array.from(projectsMap.values())),
    users: serialize(users),
    stats,
  };
}
