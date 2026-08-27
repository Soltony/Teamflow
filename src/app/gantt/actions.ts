
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
            status: true,
            milestones: {
                orderBy: {
                    dueDate: 'asc'
                },
                include: {
                    // The timeline draws tasks beneath their milestone and
                    // needs the dependency links to find the critical path.
                    // Narrow select: a portfolio-wide schedule can cover
                    // thousands of tasks, and none of them need descriptions.
                    tasks: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            startDate: true,
                            endDate: true,
                            baselineStartDate: true,
                            baselineEndDate: true,
                            progress: true,
                            weight: true,
                            dependsOn: {
                                select: { predecessorId: true, type: true, lagDays: true },
                            },
                        },
                        orderBy: { startDate: 'asc' },
                    },
                },
            }
        },
        orderBy: {
            startDate: 'asc'
        }
    });

    return serialize(projects);
}
