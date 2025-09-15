
'use server';

import prisma from "@/lib/db";
import type { Prisma } from '@prisma/client';

export async function getArchivedProjects(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) {
        return {
            projects: [],
            statuses: []
        };
    }

    const statuses = await prisma.projectStatus.findMany({
        orderBy: {
            name: 'asc'
        }
    });

    const archivedStatusNames = ['Completed', 'On Handover'];
    const archivedStatusIds = statuses.filter(s => archivedStatusNames.includes(s.name)).map(s => s.id);

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager' || role.name === 'CEO');

    let whereClause: Prisma.ProjectWhereInput = {
        statusId: {
            in: archivedStatusIds,
        }
    };

    if (!isManagerOrAdmin) {
        whereClause.OR = [
            { projectManagerId: userId },
            { teams: { some: { members: { some: { id: userId } } } } },
            { milestones: { some: { tasks: { some: { assignees: { some: { id: userId } } } } } } }
        ];
    }

    const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
            status: true,
            milestones: {
                include: {
                    tasks: true,
                },
            },
        },
        orderBy: {
            endDate: 'desc'
        }
    });

    return {
        projects: JSON.parse(JSON.stringify(projects)),
        statuses: JSON.parse(JSON.stringify(statuses.filter(s => archivedStatusNames.includes(s.name))))
    };
}

    