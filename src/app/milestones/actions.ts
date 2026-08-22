
'use server';

import prisma from "@/lib/db";
import type { Prisma } from '@prisma/client';

export async function getMilestonesPageData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) {
        return [];
    }

    // Check if user has admin-level permissions (can see all projects)
    const hasAdminPermissions = user.roles.some(role => 
        role.permissions.includes('projects:read') && 
        role.permissions.includes('projects:update') && 
        role.permissions.includes('projects:delete')
    );

    let whereClause: Prisma.ProjectWhereInput = {};

    if (!hasAdminPermissions) {
        // User is a member, so filter projects to only ones they are involved in
        whereClause = {
            OR: [
                { projectManagerId: userId },
                {
                    teams: {
                        some: {
                            members: {
                                some: { id: userId }
                            }
                        }
                    }
                },
                {
                    milestones: {
                        some: {
                            tasks: {
                                some: {
                                    assignees: {
                                        some: {
                                            id: userId
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };
    }

    const projects = await prisma.project.findMany({
        where: whereClause,
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

    return JSON.parse(JSON.stringify(projects));
}
