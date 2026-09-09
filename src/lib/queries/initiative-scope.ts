import type { Prisma } from '@prisma/client';

/**
 * Which projects sit under an initiative.
 *
 * The counterpart of division-scope.ts, and deliberately shaped like it so the
 * reports page, the dashboard and the project list cannot drift into three
 * different answers to the same question.
 *
 * One difference matters and is worth stating, because it changes how the
 * figures may be read. A project has any number of divisions on it, so
 * per-division rows overlap and do not sum to the portfolio. A project has at
 * most **one** initiative, so initiative rows are a genuine partition: every
 * project appears exactly once, and the rows — including the unassigned one —
 * add up to the whole. That is what makes "62% of the portfolio is under
 * Digital Transformation" a sentence somebody can say out loud.
 */

/**
 * The filter value standing for "projects nobody has placed under an
 * initiative".
 *
 * A real value rather than an absence, because "which work is not attached to
 * any strategic initiative" is the question the register exists to answer, and
 * it cannot be asked by a filter that only offers the initiatives themselves.
 */
export const UNASSIGNED_INITIATIVE = 'none';

/** What that value is called wherever it is offered or plotted. */
export const UNASSIGNED_INITIATIVE_LABEL = 'Not under an initiative';

/** The database clause for one initiative, or for the unassigned projects. */
export function projectsForInitiative(value: string): Prisma.ProjectWhereInput {
  return value === UNASSIGNED_INITIATIVE ? { initiativeId: null } : { initiativeId: value };
}

/**
 * Just enough of a project to place it.
 *
 * Either shape is accepted: the flat column as the form and the lighter view
 * types carry it, or the included relation as Prisma returns it. Requiring one
 * of them would have meant a cast at half the call sites.
 */
export type InitiativeScopedProject = {
  initiativeId?: string | null;
  initiative?: { id: string; name?: string } | null;
};

/**
 * The in-memory counterpart of {@link projectsForInitiative}: the key a project
 * groups under, which is {@link UNASSIGNED_INITIATIVE} when it has none.
 */
export function initiativeKeyOf(project: InitiativeScopedProject): string {
  return project.initiativeId ?? project.initiative?.id ?? UNASSIGNED_INITIATIVE;
}

export interface InitiativeGroup<P> {
  /** The initiative's id, or {@link UNASSIGNED_INITIATIVE}. */
  id: string;
  name: string;
  /** True for the one row that stands for projects under no initiative. */
  unassigned: boolean;
  projects: P[];
}

/**
 * Groups a set of projects by initiative, for the charts and report tables.
 *
 * Every initiative gets a row even when nothing is under it — an initiative on
 * record with no projects behind it is a fact worth seeing, not a row to hide.
 * The unassigned row is appended only when it has something in it, so a
 * portfolio where every project has been placed does not carry an empty
 * "Not under an initiative" line for ever.
 */
export function groupByInitiative<P extends InitiativeScopedProject>(
  projects: P[],
  initiatives: { id: string; name: string }[],
): InitiativeGroup<P>[] {
  const buckets = new Map<string, P[]>();
  for (const initiative of initiatives) buckets.set(initiative.id, []);

  const unassigned: P[] = [];
  for (const project of projects) {
    const key = initiativeKeyOf(project);
    const bucket = buckets.get(key);
    // An id with no matching initiative in the list falls in with the
    // unassigned rather than vanishing: a project must be counted somewhere,
    // or the rows stop adding up to the portfolio.
    if (bucket) bucket.push(project);
    else unassigned.push(project);
  }

  const rows: InitiativeGroup<P>[] = initiatives.map((initiative) => ({
    id: initiative.id,
    name: initiative.name,
    unassigned: false,
    projects: buckets.get(initiative.id) ?? [],
  }));

  if (unassigned.length > 0) {
    rows.push({
      id: UNASSIGNED_INITIATIVE,
      name: UNASSIGNED_INITIATIVE_LABEL,
      unassigned: true,
      projects: unassigned,
    });
  }

  return rows;
}
