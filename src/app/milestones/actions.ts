
'use server';

import prisma from "@/lib/db";
import type { Prisma } from '@prisma/client';
import { requirePermission, canSeeAllProjects } from "@/lib/auth/guard";
import { resolvePage, type PageRequest } from "@/lib/pagination";
import { serialize } from '@/lib/serialize';
import { projectVisibilityClauses } from '@/lib/queries/project-visibility';

/** Identity comes from the session; `_userId` is ignored (see archive/actions.ts). */
export async function getMilestonesPageData(_userId?: string, pageRequest: PageRequest = {}) {
    const user = await requirePermission('milestones:view');
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

    const totalCount = await prisma.project.count({ where: whereClause });
    const { skip, pageSize } = resolvePage(pageRequest, totalCount);

    const projects = await prisma.project.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        include: {
            responsibleDepartments: true,
            milestones: {
                include: {
                    tasks: true, // Include tasks to check milestone completion status
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return serialize(projects);
}
