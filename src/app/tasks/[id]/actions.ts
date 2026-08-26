
'use server';

import prisma from "@/lib/db";
import { TaskStatus, TaskUpdate as PrismaTaskUpdate, User as PrismaUser } from "@prisma/client";
import { requireUser, userHasPermission } from "@/lib/auth/guard";
import { serialize } from "@/lib/serialize";
import { USER_DISPLAY_SELECT } from '@/lib/queries/user-select';

type TaskUpdate = Omit<PrismaTaskUpdate, 'type'> & { type: 'COMMENT' | 'STATUS_CHANGE' };
type User = Omit<PrismaUser, 'emailVerified'>;

export type TaskDetails = Awaited<ReturnType<typeof getTaskDetails>>;

/** Identity comes from the session; `_userId` is ignored (see archive/actions.ts). */
export async function getTaskDetails(taskId: string, _userId?: string) {
    const user = await requireUser();
    const userId = user.id;

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
                    author: { select: USER_DISPLAY_SELECT }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            },
            assignees: { select: USER_DISPLAY_SELECT }
        }
    });

    if (!task) {
        return null;
    }
    
    // Authorization Check
    const isAssignee = task.assignees.some(assignee => assignee.id === userId);
    const hasApprovalPermission = userHasPermission(user, 'tasks:approve');

    // Allow access if the user is an assignee OR has approval permissions
    if (!isAssignee && !hasApprovalPermission) {
        return null;
    }

    // Only the fields this page renders, not every user's contact details.
    const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, avatar: true, email: true },
    });

    const normalizedTask = {
        ...task,
        status: task.status as TaskStatus,
        updates: task.updates.map(u => ({ ...u, type: u.type as TaskUpdate['type'] })),
        assignedUserIds: task.assignees.map(a => a.id),
    };

    // Typed serialisation: the page infers real field types from this instead
    // of the `any` that JSON.parse produced, which is what made every callback
    // parameter on the detail page implicitly any.
    return {
        task: serialize(normalizedTask),
        allUsers: serialize(allUsers),
    };
}
