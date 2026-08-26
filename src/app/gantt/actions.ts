
'use server';

import prisma from "@/lib/db";
import type { Prisma } from '@prisma/client';
import { requirePermission, canSeeAllProjects } from "@/lib/auth/guard";
import { serialize } from '@/lib/serialize';
import { projectVisibilityClauses } from '@/lib/queries/project-visibility';

/** Identity comes from the session; `_userId` is ignored (see archive/actions.ts). */
export async function getGanttPageData(_userId?: string) {
    const user = await requirePermission('gantt:view');
    const userId = user.id;

    if (!user) {
        return [];
    }

    // Check if user has admin-level permissions (can see all projects)
    // One explicit permission, checked in one place. See canSeeAllProjects().
    const hasAdminPermissions = canSeeAllProjects(user);

    let whereClause: Prisma.ProjectWhereInput = {};

    if (!hasAdminPermissions) {
        // User is a member, so filter projects to only ones they are involved in
        whereClause = {
            OR: projectVisibilityClauses(userId)
        };
    }

    const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
            milestones: {
                orderBy: {
                    dueDate: 'asc'
                }
            }
        },
        orderBy: {
            startDate: 'asc'
        }
    });

    return serialize(projects);
}
