
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export async function getPendingReviewTasks(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true }
    });

    if (!user) return [];

    const canManageAll = user.roles.some(role => role.name === 'Admin');

    let whereClause: Prisma.TaskWhereInput = {
        status: 'PENDING_REVIEW'
    };

    if (!canManageAll) {
        // If not an admin, only show tasks from teams the user leads
        const ledTeams = await prisma.team.findMany({
            where: { teamLeadId: userId },
            include: { members: { select: { id: true } } }
        });
        const memberIds = Array.from(new Set(ledTeams.flatMap(team => team.members.map(m => m.id))));

        if (memberIds.length === 0) return []; // Not a team lead of any team

        whereClause.assignees = {
            some: {
                id: { in: memberIds }
            }
        };
    }

    const tasks = await prisma.task.findMany({
        where: whereClause,
        include: {
            assignees: true,
            milestone: {
                include: {
                    project: true
                }
            },
            updates: {
                orderBy: {
                    createdAt: 'desc'
                }
            }
        },
        orderBy: {
            endDate: 'asc'
        }
    });

    return JSON.parse(JSON.stringify(tasks));
}

export async function approveTask(taskId: string, reviewerId: string) {
    await prisma.task.update({
        where: { id: taskId },
        data: {
            status: 'DONE',
            completedAt: new Date(),
            updates: {
                create: {
                    text: 'Task has been reviewed and approved.',
                    authorId: reviewerId,
                    type: 'STATUS_CHANGE',
                }
            }
        }
    });
    revalidatePath('/task-approvals');
    revalidatePath('/team-view');
    revalidatePath('/my-tasks');
}

export async function rejectTask(taskId: string, reviewerId: string, reason: string) {
    await prisma.task.update({
        where: { id: taskId },
        data: {
            status: 'IN_PROGRESS',
            updates: {
                create: {
                    text: `Task declined. Reason: ${reason}`,
                    authorId: reviewerId,
                    type: 'STATUS_CHANGE',
                }
            }
        }
    });
    revalidatePath('/task-approvals');
    revalidatePath('/team-view');
    revalidatePath('/my-tasks');
}
