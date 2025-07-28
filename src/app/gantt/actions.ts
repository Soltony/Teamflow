
'use server';

import prisma from "@/lib/db";
import type { Prisma } from '@prisma/client';

export async function getGanttPageData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) {
        return [];
    }

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager' || role.name === 'CEO');

    let whereClause: Prisma.ProjectWhereInput = {};

    if (!isManagerOrAdmin) {
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

    return JSON.parse(JSON.stringify(projects));
}
