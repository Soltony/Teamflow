
'use server';

import prisma from "@/lib/db";
import { TaskStatus, TaskUpdate as PrismaTaskUpdate, User as PrismaUser } from "@prisma/client";

type TaskUpdate = Omit<PrismaTaskUpdate, 'type'> & { type: 'COMMENT' | 'STATUS_CHANGE' };
type User = Omit<PrismaUser, 'emailVerified'>;

export type TaskDetails = Awaited<ReturnType<typeof getTaskDetails>>;

export async function getTaskDetails(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
            milestone: {
                select: {
                    id: true,
                    title: true,
                    project: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                }
            },
            updates: {
                include: {
                    author: true
                },
                orderBy: {
                    createdAt: 'asc'
                }
            },
            assignees: true
        }
    });

    if (!task) {
        return null;
    }
    
    // Basic authorization: ensure user is an assignee
    const isAssignee = task.assignees.some(assignee => assignee.id === userId);
    
    // More complex auth: is team lead, project manager, or admin?
    // This is a simplified check. A real app would have more robust permission checks.
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true }});
    const canManage = user?.roles.some(r => ['Admin', 'Project Manager', 'Team Lead'].includes(r.name));

    if (!isAssignee && !canManage) {
        return null;
    }

    const allUsers = await prisma.user.findMany();

    const normalizedTask = {
        ...task,
        status: task.status as TaskStatus,
        updates: task.updates.map(u => ({...u, author: u.author as User, type: u.type as TaskUpdate['type'], progressPercentage: u.progressPercentage})),
        assignedUserIds: task.assignees.map(a => a.id),
    };

    return {
        task: JSON.parse(JSON.stringify(normalizedTask)),
        allUsers: JSON.parse(JSON.stringify(allUsers))
    };
}
