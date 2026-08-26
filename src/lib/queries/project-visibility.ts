import type { Prisma } from '@prisma/client';

/**
 * Which projects a person may see.
 *
 * This predicate was written out by hand in six different files. That is how an
 * access-control rule drifts: one copy gains a clause, the others do not, and
 * the same user sees a project on one screen and not on another. It is one
 * function now, so a change to who may see what is a change in one place.
 *
 * Callers that hold a permission such as `projects:read-all` should skip this
 * entirely — see canSeeAllProjects().
 */
export function projectVisibilityWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      // The person accountable for the project.
      { projectManagerId: userId },

      // Formally assigned to it, in any capacity. This is the clause that
      // arrived with ProjectAssignment: a sponsor or stakeholder is involved
      // without being in a team or holding a task.
      { assignments: { some: { userId } } },

      // A member of a team that works on it. Teams are linked through
      // ProjectTeam now, so this reaches through the join.
      { teamLinks: { some: { team: { members: { some: { id: userId } } } } } },

      // Leads a team that works on it — a lead is not necessarily also listed
      // among that team's members.
      { teamLinks: { some: { team: { teamLeadId: userId } } } },

      // Holds a task on it.
      { milestones: { some: { tasks: { some: { assignees: { some: { id: userId } } } } } } },
    ],
  };
}

/**
 * The same rule expressed as the OR clauses alone.
 *
 * For callers that are already building a `where` with other conditions and
 * need to attach `OR` themselves.
 */
export function projectVisibilityClauses(userId: string): Prisma.ProjectWhereInput[] {
  return projectVisibilityWhere(userId).OR as Prisma.ProjectWhereInput[];
}
