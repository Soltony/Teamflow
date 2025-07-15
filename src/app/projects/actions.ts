
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@/lib/types";
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export async function getNewProjectData() {
    const [users, departments, projectStatuses] = await Promise.all([
        prisma.user.findMany({ include: { roles: { select: { name: true } } } }),
        prisma.department.findMany(),
        prisma.projectStatus.findMany(),
      ]);

      return {
        users: JSON.parse(JSON.stringify(users)),
        departments: JSON.parse(JSON.stringify(departments)),
        projectStatuses: JSON.parse(JSON.stringify(projectStatuses)),
      }
}


export async function createProject(data: any) {
    const { milestones, hasCost, ...projectData } = data;

    await prisma.project.create({
        data: {
            ...projectData,
            totalCost: hasCost ? new Decimal(projectData.totalCost || 0) : null,
            costByMilestones: hasCost ? projectData.costByMilestones : false,
            milestones: {
                create: milestones.map((m: any) => ({
                    title: m.title,
                    description: m.description,
                    startDate: m.startDate,
                    dueDate: m.dueDate,
                    weight: m.weight,
                    cost: hasCost && projectData.costByMilestones ? new Decimal(m.cost || 0) : null,
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

export async function getProjectForEdit(projectId: string) {
    const [project, users, departments, projectStatuses] = await Promise.all([
        prisma.project.findUnique({
            where: { id: projectId },
            include: {
                milestones: {
                    include: {
                        responsibleDepartments: {
                            select: { id: true }
                        }
                    }
                }
            }
        }),
        prisma.user.findMany({ include: { roles: { select: { name: true } } }, orderBy: { name: 'asc' } }),
        prisma.department.findMany({ orderBy: { name: 'asc' } }),
        prisma.projectStatus.findMany({ orderBy: { name: 'asc' } }),
    ]);

    if (!project) return null;

    const normalizedProject = {
        ...project,
        hasCost: project.totalCost !== null,
        milestones: project.milestones.map(m => ({
            ...m,
            responsibleDepartmentIds: m.responsibleDepartments.map(d => d.id)
        }))
    };

    return {
        project: JSON.parse(JSON.stringify(normalizedProject)),
        users: JSON.parse(JSON.stringify(users)),
        departments: JSON.parse(JSON.stringify(departments)),
        projectStatuses: JSON.parse(JSON.stringify(projectStatuses)),
    };
}


export async function updateProject(projectId: string, data: any) {
    const { milestones, hasCost, ...projectData } = data;

    const existingMilestones = await prisma.milestone.findMany({
        where: { projectId: projectId },
        select: { id: true }
    });
    const existingMilestoneIds = existingMilestones.map(m => m.id);

    const incomingMilestoneIds = milestones.filter((m: any) => m.id).map((m: any) => m.id);
    const milestoneIdsToDelete = existingMilestoneIds.filter((id: string) => !incomingMilestoneIds.includes(id));

    try {
        await prisma.$transaction(async (tx) => {
            if (milestoneIdsToDelete.length > 0) {
                const tasksInDeletedMilestones = await tx.task.findMany({
                    where: { milestoneId: { in: milestoneIdsToDelete }},
                    select: { id: true }
                });
                const taskIdsToDelete = tasksInDeletedMilestones.map(t => t.id);

                if (taskIdsToDelete.length > 0) {
                     await tx.taskUpdate.deleteMany({
                        where: { taskId: { in: taskIdsToDelete }}
                    });
                    await tx.task.deleteMany({
                        where: { id: { in: taskIdsToDelete }}
                    });
                }
                await tx.milestone.deleteMany({
                    where: { id: { in: milestoneIdsToDelete } }
                });
            }

            await tx.project.update({
                where: { id: projectId },
                data: {
                  name: projectData.name,
                  description: projectData.description,
                  startDate: projectData.startDate,
                  endDate: projectData.endDate,
                  statusId: projectData.statusId,
                  departmentId: projectData.departmentId,
                  projectManagerId: projectData.projectManagerId,
                  workingYear: projectData.workingYear,
                  totalCost: hasCost ? new Decimal(projectData.totalCost || 0) : null,
                  costByMilestones: hasCost ? projectData.costByMilestones : false,
                }
            });

            for (const milestone of milestones) {
                const { id, responsibleDepartmentIds, ...milestoneData } = milestone;
                
                const dataForUpsert = {
                    title: milestoneData.title,
                    description: milestoneData.description,
                    startDate: milestoneData.startDate,
                    dueDate: milestoneData.dueDate,
                    weight: milestoneData.weight,
                    cost: hasCost && projectData.costByMilestones ? new Decimal(milestoneData.cost || 0) : null,
                    responsibleDepartments: {
                        set: responsibleDepartmentIds.map((deptId: string) => ({ id: deptId }))
                    }
                };

                if (id) {
                    await tx.milestone.update({
                        where: { id: id },
                        data: dataForUpsert
                    });
                } else {
                    await tx.milestone.create({
                        data: {
                            ...dataForUpsert,
                             project: { connect: { id: projectId } },
                        }
                    });
                }
            }
        });

        revalidatePath('/projects');
        revalidatePath(`/projects/${projectId}`);
        revalidatePath(`/projects/${projectId}/edit`);
        revalidatePath('/dashboard');
        revalidatePath('/gantt');
        revalidatePath('/milestones');
        return { success: true };
    } catch (e) {
        console.error("Failed to update project", e);
        return { success: false, error: 'Failed to update project. Please ensure all data is correct.' };
    }
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

export async function deleteBlocker(blockerId: string, projectId: string) {
    await prisma.blocker.delete({
        where: { id: blockerId },
    });
    revalidatePath(`/projects/${projectId}`);
}

export async function updateBlocker(blockerId: string, description: string, projectId: string) {
    await prisma.blocker.update({
        where: { id: blockerId },
        data: {
            description,
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


export async function getProjectDetailsForUser(projectId: string, userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) {
        return null; // User not found
    }

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            status: true,
            owningDepartment: true,
            projectManager: true,
            blockers: true,
            milestones: {
                include: {
                    tasks: {
                        include: {
                            assignees: true,
                            updates: true,
                        }
                    }
                }
            }
        }
    });

    if (!project) {
        return null; // Project not found
    }

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager');
    if (isManagerOrAdmin) {
        return JSON.parse(JSON.stringify(project));
    }

    // If not admin/manager, check for involvement
    const userInvolvement = await prisma.project.findFirst({
        where: {
            id: projectId,
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
                {
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
        }
    });

    if (!userInvolvement) {
        return null; // User is not involved in this project
    }

    return JSON.parse(JSON.stringify(project));
}

export async function getProjectMilestonesForUser(projectId: string, userId: string) {
    // First, verify the user has access to the project
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) return null;

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager');
    
    let whereClause: Prisma.ProjectWhereUniqueInput = { id: projectId };
    
    if (!isManagerOrAdmin) {
        const projectAccess = await prisma.project.findFirst({
            where: {
                id: projectId,
                OR: [
                    { projectManagerId: userId },
                    { teams: { some: { members: { some: { id: userId } } } } },
                    { milestones: { some: { tasks: { some: { assignees: { some: { id: userId } } } } } } }
                ]
            },
            select: { id: true }
        });

        if (!projectAccess) return null; // No access
    }
    
    // If access is confirmed, fetch the required data
    const project = await prisma.project.findUnique({
        where: whereClause,
        include: {
            milestones: {
                include: {
                    tasks: {
                        include: {
                            assignees: true,
                        }
                    },
                    responsibleDepartments: true
                }
            }
        }
    });

    if (!project) return null;

    const [users, departments] = await Promise.all([
        prisma.user.findMany({ include: { roles: { select: { name: true } } } }),
        prisma.department.findMany()
    ]);

    return {
        project: JSON.parse(JSON.stringify(project)),
        users: JSON.parse(JSON.stringify(users)),
        departments: JSON.parse(JSON.stringify(departments))
    };
}
