
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { type ProjectWithTasksAndStats, type TeamViewTask } from "./page";
import type { TaskStatus as TaskStatusType, TaskUpdate, User } from "@/lib/types";

export async function getTeamViewData(userId: string) {
    const [allUsers, projectStatuses, ledTeams] = await Promise.all([
        prisma.user.findMany(),
        prisma.projectStatus.findMany(),
        prisma.team.findMany({
            where: { teamLeadId: userId },
            include: { members: true }
        })
    ]);

    const teamMemberIds = Array.from(new Set(ledTeams.flatMap(team => team.members.map(m => m.id))));

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
                            select: {
                                id: true,
                                name: true,
                                status: true
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

        tasksByProject = teamMemberTasks.reduce((acc, task) => {
            const projectId = task.milestone.project.id;
            if (!acc[projectId]) {
                acc[projectId] = {
                    project: {
                        id: projectId,
                        name: task.milestone.project.name,
                        statusId: task.milestone.project.status?.id ?? null,
                    },
                    tasks: [],
                    stats: { pending: 0, inProgress: 0, done: 0, todo: 0, total: 0 }
                };
            }
            
            const userTask: TeamViewTask = {
                ...task,
                status: task.status as TaskStatusType,
                updates: task.updates.map(u => ({ ...u, type: u.type as TaskUpdate['type'], createdAt: u.createdAt.toISOString(), author: u.author as User, authorId: u.authorId, id: u.id, text: u.text })),
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
        ledTeams: JSON.parse(JSON.stringify(ledTeams)),
        tasksByProject: JSON.parse(JSON.stringify(Object.values(tasksByProject))),
        projectStatuses: JSON.parse(JSON.stringify(projectStatuses)),
    };
}


export async function approveTaskAction(taskId: string, teamLeadId: string, teamLeadName: string) {
    try {
        const updateText = `Task approved by ${teamLeadName}. Status changed to Done.`;
        
        await prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'DONE',
                completedAt: new Date(),
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
        return { success: true };

    } catch (error) {
        console.error("Failed to approve task:", error);
        return { success: false, error: "Failed to approve task." };
    }
}


export async function declineTaskAction(taskId: string, teamLeadId: string, teamLeadName: string) {
    try {
        const updateText = `Task declined by ${teamLeadName}. Status changed back to In Progress.`;
        
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
        return { success: true };

    } catch (error) {
        console.error("Failed to decline task:", error);
        return { success: false, error: "Failed to decline task." };
    }
}
