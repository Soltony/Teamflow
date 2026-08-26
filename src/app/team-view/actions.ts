
'use server';

import prisma from "@/lib/db";
import { notifyMany } from "@/lib/notifications/notify";
import { revalidatePath } from "next/cache";
import { type ProjectWithTasksAndStats, type TeamViewTask } from "./page";
import type { TaskStatus as TaskStatusType, TaskUpdate, User } from "@/lib/types";
import type { Prisma } from "@prisma/client";
import { requirePermission, userHasPermission } from "@/lib/auth/guard";
import { serialize } from "@/lib/serialize";
import { USER_DISPLAY_SELECT } from '@/lib/queries/user-select';

/** Identity comes from the session; `_userId` is ignored (see archive/actions.ts). */
export async function getTeamViewData(_userId?: string) {
    const currentUser = await requirePermission('team-view:view');
    const userId = currentUser.id;

    const [allUsers, projectStatuses] = await Promise.all([
        // Only the fields the team view renders; the full user records,
        // including everyone's email and phone number, used to be sent.
        prisma.user.findMany({ select: { id: true, name: true, avatar: true, email: true } }),
        prisma.projectStatus.findMany(),
    ]);

    const canManageAll = userHasPermission(currentUser, 'team-view:manage-all');
    
    const teamWhereClause: Prisma.TeamWhereInput = canManageAll ? {} : { teamLeadId: userId };

    const teams = await prisma.team.findMany({
        where: teamWhereClause,
        include: { members: { select: USER_DISPLAY_SELECT } }
    });

    const teamMemberIds = Array.from(new Set(teams.flatMap(team => team.members.map(m => m.id))));

    /** Built from Prisma rows; converted to the client shape at the return. */
    type ProjectBucket = {
        project: {
            id: string;
            name: string;
            statusId: string | null;
            endDate: Date;
            createdAt: Date;
            milestones: unknown[];
        };
        tasks: unknown[];
        stats: { pending: number; inProgress: number; done: number; todo: number; total: number };
    };

    let tasksByProject: Record<string, ProjectBucket> = {};

    if (teamMemberIds.length > 0) {
        const teamMemberTasks = await prisma.task.findMany({
            where: {
                assignees: {
                    some: {
                        id: {
                            in: teamMemberIds,
                        }
                    }
                }
            },
            include: {
                milestone: {
                    select: {
                        id: true,
                        title: true,
                        project: {
                           include: {
                             status: true,
                             milestones: {
                                include: {
                                    tasks: true,
                                }
                             }
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

        tasksByProject = teamMemberTasks.reduce((acc, task) => {
            const project = task.milestone.project;
            const projectId = project.id;

            if (!acc[projectId]) {
                acc[projectId] = {
                    project: {
                        id: projectId,
                        name: project.name,
                        statusId: project.status?.id ?? null,
                        endDate: project.endDate,
                        createdAt: project.createdAt,
                        milestones: project.milestones,
                    },
                    tasks: [],
                    stats: { pending: 0, inProgress: 0, done: 0, todo: 0, total: 0 }
                };
            }
            
            const userTask = {
                ...task,
                status: task.status as TaskStatusType,
                updates: task.updates.map(u => ({ ...u, type: u.type as TaskUpdate['type'], createdAt: u.createdAt, author: u.author as User, authorId: u.authorId, id: u.id, text: u.text, progressPercentage: u.progressPercentage })),
                projectId: task.milestone.project.id,
                projectName: task.milestone.project.name,
                milestoneId: task.milestone.id,
                milestoneTitle: task.milestone.title,
                assignedUserIds: task.assignees.map(a => a.id),
                startDate: task.startDate,
                endDate: task.endDate,
                completedAt: task.completedAt,
            };
            
            acc[projectId].tasks.push(userTask);
            acc[projectId].stats.total++;
            if (task.status === 'PENDING_REVIEW') acc[projectId].stats.pending++;
            else if (task.status === 'IN_PROGRESS') acc[projectId].stats.inProgress++;
            else if (task.status === 'DONE') acc[projectId].stats.done++;
            else if (task.status === 'TODO') acc[projectId].stats.todo++;

            return acc;
        }, {} as Record<string, ProjectBucket>);
    }

    return {
        allUsers: serialize(allUsers),
        ledTeams: serialize(teams),
        tasksByProject: serialize(Object.values(tasksByProject)),
        projectStatuses: serialize(projectStatuses),
    };
}


/**
 * Approves a task from the team view.
 *
 * Both the reviewer's id and their display name now come from the session. The
 * name was previously passed in by the caller and written verbatim into the
 * task history, which meant the audit trail could be made to name someone who
 * had not acted.
 */
export async function approveTaskAction(taskId: string, _teamLeadId?: string, _teamLeadName?: string) {
    try {
        const reviewer = await requirePermission(['team-view:manage', 'team-view:manage-all', 'tasks:approve']);
        const teamLeadId = reviewer.id;
        const teamLeadName = reviewer.name;

        const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: { select: USER_DISPLAY_SELECT } } });
        if (!task) {
            return { success: false, error: "Task not found." };
        }
        if (task.assignees.some(a => a.id === teamLeadId)) {
            return { success: false, error: "You cannot approve your own work on this task." };
        }

        const isComplete = task.progress === 100;
        let updateText = '';
        let newStatus: TaskStatusType;

        if (isComplete) {
            newStatus = 'DONE';
            updateText = `Task approved as complete by ${teamLeadName}. Status changed to Done.`;
        } else {
            newStatus = 'IN_PROGRESS';
            updateText = `Progress update to ${task.progress}% was approved by ${teamLeadName}. Status is now In Progress.`;
        }
        
        await prisma.task.update({
            where: { id: taskId },
            data: {
                status: newStatus,
                completedAt: isComplete ? new Date() : null,
                updates: {
                    create: {
                        text: updateText,
                        authorId: teamLeadId,
                        type: 'STATUS_CHANGE',
                        progressPercentage: task.progress,
                    }
                }
            }
        });

        // Notify assignees
        const message = `Your work on task "${task.title}" was approved. Status is now "${newStatus.replace('_', ' ')}".`;
        const link = `/tasks/${task.id}`;
        await notifyMany(
            prisma,
            { message, link, senderId: teamLeadId },
            task.assignees.map((a) => a.id),
        );

        revalidatePath('/team-view');
        revalidatePath('/my-tasks');
        revalidatePath('/task-approvals');
        revalidatePath('/notifications');
        return { success: true };

    } catch (error) {
        console.error("Failed to approve task:", error);
        return { success: false, error: "Failed to approve task." };
    }
}


export async function declineTaskAction(
    taskId: string,
    _teamLeadId: string | undefined,
    _teamLeadName: string | undefined,
    reason: string,
) {
    try {
        const reviewer = await requirePermission(['team-view:manage', 'team-view:manage-all', 'tasks:approve']);
        const teamLeadId = reviewer.id;
        const teamLeadName = reviewer.name;

        const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: { select: USER_DISPLAY_SELECT } } });
        if (!task) {
            return { success: false, error: "Task not found." };
        }
        if (task.assignees.some(a => a.id === teamLeadId)) {
            return { success: false, error: "You cannot review your own work on this task." };
        }

        const updateText = `Task declined by ${teamLeadName}. Reason: ${reason}`;
        
        await prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'IN_PROGRESS',
                updates: {
                    create: {
                        text: updateText,
                        authorId: teamLeadId,
                        type: 'STATUS_CHANGE',
                    }
                }
            }
        });
        
        // Notify assignees
        const message = `Your update for task "${task.title}" was declined. Reason: ${reason}`;
        const link = `/tasks/${task.id}`;
        await notifyMany(
            prisma,
            { message, link, senderId: teamLeadId },
            task.assignees.map((a) => a.id),
        );

        revalidatePath('/team-view');
        revalidatePath('/my-tasks');
        revalidatePath('/task-approvals');
        revalidatePath('/notifications');
        return { success: true };

    } catch (error) {
        console.error("Failed to decline task:", error);
        return { success: false, error: "Failed to decline task." };
    }
}
