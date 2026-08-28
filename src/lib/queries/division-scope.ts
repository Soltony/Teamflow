import type { Prisma } from '@prisma/client';

/**
 * Which projects a division is on.
 *
 * A project has exactly one owning division — the one accountable for it, the
 * one whose managers may run it — and any number of participating divisions
 * beside it. "Involved in" therefore means either relation. Scoping to the
 * owner alone, which is all that was possible before participants existed,
 * hid from a division every project it worked on but did not own.
 *
 * Written once and shared so the dashboard, the reports page, the project list
 * and the approval queue cannot drift into three different answers.
 */
export function projectsForDivision(divisionId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { pmoDivisionId: divisionId },
      { participatingDivisions: { some: { id: divisionId } } },
    ],
  };
}

/**
 * Just enough of a project to answer the question without a round trip.
 *
 * Either shape of the participant list is accepted: the relation as Prisma
 * returns it, or the flat list of ids the forms and the lighter view types
 * carry. Requiring one of them would have meant a cast at half the call sites.
 */
export type DivisionScopedProject = {
  pmoDivisionId: string;
  participatingDivisions?: { id: string }[] | null;
  participatingDivisionIds?: string[] | null;
};

function participantIds(project: DivisionScopedProject): string[] {
  if (project.participatingDivisions) return project.participatingDivisions.map((d) => d.id);
  return project.participatingDivisionIds ?? [];
}

/**
 * The in-memory counterpart of {@link projectsForDivision}, for the charts and
 * report tables that group a set they already hold.
 */
export function isDivisionOnProject(
  project: DivisionScopedProject,
  divisionId: string,
): boolean {
  return project.pmoDivisionId === divisionId || participantIds(project).includes(divisionId);
}

/** Every division on a project, the owner first. */
export function divisionIdsOnProject(project: DivisionScopedProject): string[] {
  return [project.pmoDivisionId, ...participantIds(project)].filter(Boolean);
}
