
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { type ProjectWithTasksAndStats, type TeamViewTask } from "./page";
import type { TaskStatus as TaskStatusType, TaskUpdate, User } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export async function getTeamViewData(userId: string) {
    const [allUsers, projectStatuses, currentUser] = await Promise.all([
        prisma.user.findMany(),
        prisma.projectStatus.findMany(),
        prisma.user.findUnique({
            where: { id: userId },
            include: { roles: true }
        })
    ]);

    if (!currentUser) {
        return {
            allUsers: [],
            ledTeams: [],
            tasksByProject: [],
            projectStatuses: [],
        };
    }
    
    const canManageAll = currentUser.roles.some(role => 
        role.permissions.includes('team-view:manage-all') || role.name === 'Admin'
    );
    
    const teamWhereClause: Prisma.TeamWhereInput = canManageAll ? {} : { teamLeadId: userId };

    const teams = await prisma.team.findMany({
        where: teamWhereClause,
        include: { members: true }
    });

    const teamMemberIds = Array.from(new Set(teams.flatMap(team => team.members.map(m => m.id))));

    let tasksByProject: Record<string, ProjectWithTasksAndStats> = {};

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
                        author: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                assignees: true
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
                        milestones: project.milestones,
                    },
                    tasks: [],
                    stats: { pending: 0, inProgress: 0, done: 0, todo: 0, total: 0 }
                };
            }
            
            const userTask: TeamViewTask = {
                ...task,
                status: task.status as TaskStatusType,
                updates: task.updates.map(u => ({ ...u, type: u.type as TaskUpdate['type'], createdAt: u.createdAt.toISOString(), author: u.author as User, authorId: u.authorId, id: u.id, text: u.text, progressPercentage: u.progressPercentage })),
                projectId: task.milestone.project.id,
                projectName: task.milestone.project.name,
                milestoneId: task.milestone.id,
                milestoneTitle: task.milestone.title,
                assignedUserIds: task.assignees.map(a => a.id),
                startDate: task.startDate.toISOString(),
                endDate: task.endDate.toISOString(),
                completedAt: task.completedAt?.toISOString(),
            };
            
            acc[projectId].tasks.push(userTask);
            acc[projectId].stats.total++;
            if (task.status === 'PENDING_REVIEW') acc[projectId].stats.pending++;
            else if (task.status === 'IN_PROGRESS') acc[projectId].stats.inProgress++;
            else if (task.status === 'DONE') acc[projectId].stats.done++;
            else if (task.status === 'TODO') acc[projectId].stats.todo++;

            return acc;
        }, {} as Record<string, ProjectWithTasksAndStats>);
    }

    return {
        allUsers: JSON.parse(JSON.stringify(allUsers)),
        ledTeams: JSON.parse(JSON.stringify(teams)),
        tasksByProject: JSON.parse(JSON.stringify(Object.values(tasksByProject))),
        projectStatuses: JSON.parse(JSON.stringify(projectStatuses)),
    };
}


export async function approveTaskAction(taskId: string, teamLeadId: string, teamLeadName: string) {
    try {
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            return { success: false, error: "Task not found." };
        }

        const isComplete = task.progress === 100;
        let updateText = '';
        let newStatus: TaskStatusType;

        if (isComplete) {
            newStatus = 'DONE';
            updateText = `Task approved by ${teamLeadName}. Status changed to Done.`;
        } else {
            newStatus = task.progress > 0 ? 'IN_PROGRESS' : 'TODO';
            updateText = `Progress update of ${task.progress}% was approved by ${teamLeadName}. Status is now ${newStatus.replace(/_/g, ' ')}.`;
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

        revalidatePath('/team-view');
        revalidatePath('/my-tasks');
        revalidatePath('/task-approvals');
        return { success: true };

    } catch (error) {
        console.error("Failed to approve task:", error);
        return { success: false, error: "Failed to approve task." };
    }
}


export async function declineTaskAction(taskId: string, teamLeadId: string, teamLeadName: string, reason: string) {
    try {
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

        revalidatePath('/team-view');
        revalidatePath('/my-tasks');
        revalidatePath('/task-approvals');
        return { success: true };

    } catch (error) {
        console.error("Failed to decline task:", error);
        return { success: false, error: "Failed to decline task." };
    }
}
