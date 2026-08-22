
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import type { TaskStatus } from "@/lib/types";

export async function getPendingReviewTasks(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true }
    });

    if (!user) return [];
    
    const canApprove = user.roles.some(role => role.permissions.includes('tasks:approve'));
    if (!canApprove) return [];

    const isAdmin = user.roles.some(role => role.name === 'Admin');

    let whereClause: Prisma.TaskWhereInput = {
        status: 'PENDING_REVIEW'
    };

    if (!isAdmin) {
        // If not an admin but has approve permission, it could be a director or team lead
        if (user.pmoDivisionId) {
            // If the user is associated with a PMO division (like a director), show all tasks from that division.
             whereClause.milestone = {
                project: {
                    pmoDivisionId: user.pmoDivisionId,
                }
            };
        } else {
            // Fallback for users who are team leads but not part of a division structure
            const ledTeams = await prisma.team.findMany({
                where: { teamLeadId: userId },
                include: { members: { select: { id: true } } }
            });
            const memberIds = Array.from(new Set(ledTeams.flatMap(team => team.members.map(m => m.id))));

            if (memberIds.length === 0) return []; // Not a lead of any team with members

            whereClause.assignees = {
                some: {
                    id: { in: memberIds }
                }
            };
        }
    }
    // If user is Admin, the whereClause is not modified, so they see all pending tasks.

    const tasks = await prisma.task.findMany({
        where: whereClause,
        select: {
            id: true,
            title: true,
            description: true,
            status: true,
            progress: true,
            endDate: true,
            assignees: {
                select: {
                    id: true,
                    name: true,
                }
            },
            milestone: {
                select: {
                    project: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                }
            },
            updates: {
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    id: true,
                    text: true,
                    createdAt: true,
                    type: true,
                    progressPercentage: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        }
                    }
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
    try {
        const task = await prisma.task.findUnique({ 
            where: { id: taskId },
            include: { assignees: true }
        });
        if (!task) {
            return { success: false, error: "Task not found." };
        }

        const isComplete = task.progress === 100;
        let newStatus: TaskStatus = 'IN_PROGRESS';
        let updateText: string;

        if (isComplete) {
            newStatus = 'DONE';
            updateText = `Task has been reviewed and approved as complete. Status changed to Done.`;
        } else {
            newStatus = 'IN_PROGRESS';
            updateText = `Progress update to ${task.progress}% was approved. Status is now In Progress.`;
        }

        await prisma.task.update({
            where: { id: taskId },
            data: {
                status: newStatus,
                completedAt: isComplete ? new Date() : null,
                updates: {
                    create: {
                        text: updateText,
                        authorId: reviewerId,
                        type: 'STATUS_CHANGE',
                        progressPercentage: task.progress,
                    }
                }
            }
        });
        
        // Notify assignees
        const message = `Your work on task "${task.title}" was approved. Status is now "${newStatus.replace('_', ' ')}".`;
        const link = `/tasks/${task.id}`;
        for (const assignee of task.assignees) {
            if (assignee.id !== reviewerId) {
                await prisma.notification.create({
                    data: { message, link, recipientId: assignee.id, senderId: reviewerId }
                });
            }
        }


        revalidatePath('/task-approvals');
        revalidatePath('/team-view');
        revalidatePath('/my-tasks');
        revalidatePath('/notifications');
        return { success: true, message: updateText };
    } catch(e) {
        console.error("Failed to approve task", e);
        return { success: false, error: "An unexpected error occurred."}
    }
}

export async function rejectTask(taskId: string, reviewerId: string, reason: string) {
    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { assignees: true }
        });
        if (!task) {
            return { success: false, error: "Task not found." };
        }
        
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
        
        // Notify assignees
        const message = `Your update for task "${task.title}" was declined. Reason: ${reason}`;
        const link = `/tasks/${task.id}`;
        for (const assignee of task.assignees) {
            if (assignee.id !== reviewerId) {
                await prisma.notification.create({
                    data: { message, link, recipientId: assignee.id, senderId: reviewerId }
                });
            }
        }

        revalidatePath('/task-approvals');
        revalidatePath('/team-view');
        revalidatePath('/my-tasks');
        revalidatePath('/notifications');
        return { success: true };
    } catch(e) {
        console.error("Failed to reject task", e);
        return { success: false, error: "An unexpected error occurred."}
    }
}
