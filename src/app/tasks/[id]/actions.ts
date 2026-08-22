
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
                    createdAt: 'desc'
                }
            },
            assignees: true
        }
    });

    if (!task) {
        return null;
    }
    
    // Authorization Check
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true }});
    if (!user) return null;

    const isAssignee = task.assignees.some(assignee => assignee.id === userId);
    const hasApprovalPermission = user.roles.some(role => role.permissions.includes('tasks:approve'));

    // Allow access if the user is an assignee OR has approval permissions
    if (!isAssignee && !hasApprovalPermission) {
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
