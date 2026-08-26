import 'server-only';

import prisma from '@/lib/db';
import { canSeeAllProjects } from '@/lib/auth/access';
import type { SessionUser } from '@/lib/auth/session';
import { projectVisibilityClauses } from '@/lib/queries/project-visibility';

/**
 * Whether this user may see a given project — and therefore its documents.
 *
 * Document access is inherited rather than granted separately: a contract is
 * exactly as confidential as the project it belongs to, and a second permission
 * model would drift from the first. The same rule the project list uses is
 * applied here, so a document cannot be reachable when the project is not.
 */
export async function userCanAccessProject(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  if (canSeeAllProjects(user)) {
    const exists = await prisma.project.count({ where: { id: projectId } });
    return exists > 0;
  }

  const involved = await prisma.project.count({
    where: {
      id: projectId,
      OR: projectVisibilityClauses(user.id),
    },
  });

  return involved > 0;
}
