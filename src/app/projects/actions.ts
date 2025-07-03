
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@/lib/types";
import type { Prisma } from '@prisma/client';

export async function getNewProjectData() {
    const [users, departments, projectStatuses, activeYearSetting] = await Promise.all([
        prisma.user.findMany(),
        prisma.department.findMany(),
        prisma.projectStatus.findMany(),
        prisma.setting.findUnique({ where: { key: 'activeWorkingYear' } }),
      ]);
      const activeYear = activeYearSetting?.value || "";

      return {
        users: JSON.parse(JSON.stringify(users)),
        departments: JSON.parse(JSON.stringify(departments)),
        projectStatuses: JSON.parse(JSON.stringify(projectStatuses)),
        activeYear,
      }
}


export async function createProject(data: any) {
    const { milestones, ...projectData } = data;

    await prisma.project.create({
        data: {
            ...projectData,
            milestones: {
                create: milestones.map((m: any) => ({
                    title: m.title,
                    description: m.description,
                    startDate: m.startDate,
                    dueDate: m.dueDate,
                    weight: m.weight,
                    responsibleDepartments: {
                        connect: m.responsibleDepartmentIds.map((id: string) => ({ id }))
                    }
                }))
            }
        },
        include: {
            milestones: true,
        }
    });

    revalidatePath('/dashboard');
    revalidatePath('/projects');
    revalidatePath('/gantt');
}


export async function addBlocker(projectId: string, description: string) {
    await prisma.blocker.create({
        data: {
            description,
            status: 'OPEN',
            projectId,
        }
    });
    revalidatePath(`/projects/${projectId}`);
}

export async function resolveBlocker(blockerId: string, resolution: string, projectId: string) {
    await prisma.blocker.update({
        where: { id: blockerId },
        data: {
            status: 'RESOLVED',
            resolution,
            resolvedAt: new Date(),
        }
    });
    revalidatePath(`/projects/${projectId}`);
}


export async function updateMilestone(milestoneId: string, projectId: string, data: any) {
    const { responsibleDepartmentIds, ...milestoneData } = data;
    await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
            ...milestoneData,
            responsibleDepartments: responsibleDepartmentIds ? {
                set: responsibleDepartmentIds.map((id:string) => ({ id }))
            } : undefined
        }
    });
    revalidatePath(`/projects/${projectId}/milestones`);
    revalidatePath('/gantt');
}

export async function addTask(milestoneId: string, projectId: string, data: any) {
    const { assignedUserIds, ...taskData } = data;
    await prisma.task.create({
        data: {
            ...taskData,
            status: 'TODO',
            milestoneId,
            assignees: {
                connect: assignedUserIds.map((id:string) => ({ id }))
            }
        }
    });
    revalidatePath(`/projects/${projectId}/milestones`);
}

export async function updateTask(taskId: string, projectId: string, data: any) {
    const { assignedUserIds, ...taskData } = data;
    
    await prisma.task.update({
        where: { id: taskId },
        data: {
            ...taskData,
            assignees: assignedUserIds ? {
                set: assignedUserIds.map((id:string) => ({ id }))
            } : undefined,
        }
    });
    revalidatePath(`/projects/${projectId}/milestones`);
}

export async function getProjectsForUser(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) {
        return [];
    }

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager');

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
                { // Also check if they are assigned to any task in the project
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
            status: true,
            milestones: {
                include: {
                    tasks: true,
                },
            },
        },
        orderBy: {
            name: 'asc'
        }
    });

    return JSON.parse(JSON.stringify(projects));
}
