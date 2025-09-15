

'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@/lib/types";
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export async function getNewProjectData() {
    const [users, pmoDivisions, projectStatuses, departments] = await Promise.all([
        prisma.user.findMany({ include: { roles: { select: { name: true } } } }),
        prisma.pmoDivision.findMany(),
        prisma.projectStatus.findMany(),
        prisma.department.findMany(),
      ]);

      return {
        users: JSON.parse(JSON.stringify(users)),
        pmoDivisions: JSON.parse(JSON.stringify(pmoDivisions)),
        projectStatuses: JSON.parse(JSON.stringify(projectStatuses)),
        departments: JSON.parse(JSON.stringify(departments)),
      }
}


export async function createProject(data: any) {
    const { milestones, responsibleDepartmentIds, hasCost, ...projectData } = data;

    const newProject = await prisma.project.create({
        data: {
            ...projectData,
            totalCost: hasCost ? new Decimal(projectData.totalCost || 0) : null,
            costByMilestones: hasCost ? projectData.costByMilestones : false,
            responsibleDepartments: {
                connect: responsibleDepartmentIds.map((id: string) => ({ id }))
            },
            milestones: {
                create: milestones.map((m: any) => ({
                    title: m.title,
                    description: m.description,
                    startDate: m.startDate,
                    dueDate: m.dueDate,
                    weight: m.weight,
                    cost: hasCost && projectData.costByMilestones ? new Decimal(m.cost || 0) : null,
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
    return { success: true, project: newProject };
}

export async function getProjectForEdit(projectId: string) {
    const [project, users, pmoDivisions, projectStatuses, departments] = await Promise.all([
        prisma.project.findUnique({
            where: { id: projectId },
            include: {
                milestones: true,
                responsibleDepartments: {
                    select: { id: true }
                }
            }
        }),
        prisma.user.findMany({ include: { roles: { select: { name: true } } }, orderBy: { name: 'asc' } }),
        prisma.pmoDivision.findMany({ orderBy: { name: 'asc' } }),
        prisma.projectStatus.findMany({ orderBy: { name: 'asc' } }),
        prisma.department.findMany({ orderBy: { name: 'asc' } }),
    ]);

    if (!project) return null;

    const normalizedProject = {
        ...project,
        hasCost: project.totalCost !== null,
        responsibleDepartmentIds: project.responsibleDepartments.map(d => d.id),
    };

    return {
        project: JSON.parse(JSON.stringify(normalizedProject)),
        users: JSON.parse(JSON.stringify(users)),
        pmoDivisions: JSON.parse(JSON.stringify(pmoDivisions)),
        projectStatuses: JSON.parse(JSON.stringify(projectStatuses)),
        departments: JSON.parse(JSON.stringify(departments)),
    };
}


export async function updateProject(projectId: string, data: any) {
    const { milestones, responsibleDepartmentIds, hasCost, ...projectData } = data;

    const existingMilestones = await prisma.milestone.findMany({
        where: { projectId: projectId },
        select: { id: true }
    });
    const existingMilestoneIds = existingMilestones.map(m => m.id);

    const incomingMilestoneIds = milestones.filter((m: any) => m.id).map((m: any) => m.id);
    const milestoneIdsToDelete = existingMilestoneIds.filter((id: string) => !incomingMilestoneIds.includes(id));

    try {
        const completedStatus = await prisma.projectStatus.findUnique({
            where: { name: 'Completed' },
            select: { id: true }
        });
        const isCompletingProject = completedStatus && projectData.statusId === completedStatus.id;

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
                  pmoDivisionId: projectData.pmoDivisionId,
                  projectManagerId: projectData.projectManagerId,
                  workingYear: projectData.workingYear,
                  totalCost: hasCost ? new Decimal(projectData.totalCost || 0) : null,
                  costByMilestones: hasCost ? projectData.costByMilestones : false,
                  responsibleDepartments: {
                    set: responsibleDepartmentIds.map((id: string) => ({ id }))
                  }
                }
            });

            for (const milestone of milestones) {
                const { id, ...milestoneData } = milestone;
                
                const dataForUpsert = {
                    title: milestoneData.title,
                    description: milestoneData.description,
                    startDate: milestoneData.startDate,
                    dueDate: milestoneData.dueDate,
                    weight: milestoneData.weight,
                    cost: hasCost && projectData.costByMilestones ? new Decimal(milestoneData.cost || 0) : null,
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

            if (isCompletingProject) {
                const allProjectMilestones = await tx.milestone.findMany({
                    where: { projectId: projectId },
                    select: { id: true }
                });
                const allProjectMilestoneIds = allProjectMilestones.map(m => m.id);

                if (allProjectMilestoneIds.length > 0) {
                    await tx.task.updateMany({
                        where: { milestoneId: { in: allProjectMilestoneIds } },
                        data: {
                            status: 'DONE',
                            progress: 100,
                            completedAt: new Date(),
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

export async function addMilestone(projectId: string, data: any) {
  const { ...milestoneData } = data;
  await prisma.milestone.create({
    data: {
      ...milestoneData,
      project: { connect: { id: projectId } },
    }
  });
  revalidatePath(`/projects/${projectId}/milestones`);
}

export async function updateMilestone(milestoneId: string, projectId: string, data: any) {
    const { ...milestoneData } = data;
    await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
            ...milestoneData,
        }
    });
    revalidatePath(`/projects/${projectId}/milestones`);
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

    const finalTaskData = { ...taskData };

    if (finalTaskData.status === 'DONE') {
        finalTaskData.progress = 100;
        finalTaskData.completedAt = new Date();
    } else if (finalTaskData.status === 'TODO') {
        finalTaskData.progress = 0;
        finalTaskData.completedAt = null;
    } else if (finalTaskData.status === 'IN_PROGRESS' && finalTaskData.progress === 100) {
        // If a user moves a task back to "In Progress" from "Done" or "Pending Review",
        // but the progress is still 100%, we might want to adjust it.
        // For now, let's assume the user will manage the progress slider separately.
        // Or we could reset it:
        // finalTaskData.progress = 95; // or some other value
    }
    
    await prisma.task.update({
        where: { id: taskId },
        data: {
            ...finalTaskData,
            assignees: assignedUserIds ? {
                set: assignedUserIds.map((id:string) => ({ id }))
            } : undefined,
        }
    });
    revalidatePath(`/projects/${projectId}/milestones`);
}

export async function deleteTask(taskId: string, projectId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            await tx.taskUpdate.deleteMany({
                where: { taskId: taskId }
            });
            await tx.task.delete({
                where: { id: taskId }
            });
        });

        revalidatePath(`/projects/${projectId}/milestones`);
        revalidatePath(`/projects/${projectId}`);
        revalidatePath('/my-tasks');
        revalidatePath('/dashboard');
        
        return { success: true };
    } catch (error) {
        console.error("Failed to delete task:", error);
        return { success: false, error: "Failed to delete task." };
    }
}

export async function getProjectsPageData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) {
        return {
            projects: [],
            statuses: []
        };
    }

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager' || role.name === 'CEO');

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

    const [projects, statuses] = await Promise.all([
        prisma.project.findMany({
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
                createdAt: 'desc'
            }
        }),
        prisma.projectStatus.findMany({
            orderBy: {
                name: 'asc'
            }
        })
    ]);

    return {
        projects: JSON.parse(JSON.stringify(projects)),
        statuses: JSON.parse(JSON.stringify(statuses))
    };
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
            pmoDivision: true,
            projectManager: true,
            responsibleDepartments: true,
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

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager' || role.name === 'CEO');
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

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager' || role.name === 'CEO');
    
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
                orderBy: { createdAt: 'asc' },
                include: {
                    tasks: {
                        orderBy: { createdAt: 'asc' },
                        include: {
                            assignees: true,
                        }
                    },
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


export async function deleteProject(projectId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            // Find all milestones associated with the project
            const milestones = await tx.milestone.findMany({
                where: { projectId: projectId },
                select: { id: true }
            });
            const milestoneIds = milestones.map(m => m.id);

            if (milestoneIds.length > 0) {
                 // Delete milestone payments
                await tx.milestonePayment.deleteMany({
                    where: { milestoneId: { in: milestoneIds } }
                });

                // Find all tasks associated with these milestones
                const tasks = await tx.task.findMany({
                    where: { milestoneId: { in: milestoneIds } },
                    select: { id: true }
                });
                const taskIds = tasks.map(t => t.id);
                
                if (taskIds.length > 0) {
                    // Delete task updates
                    await tx.taskUpdate.deleteMany({
                        where: { taskId: { in: taskIds } }
                    });
                     // Delete tasks
                    await tx.task.deleteMany({
                        where: { id: { in: taskIds } }
                    });
                }
            }

            // Delete milestones
            await tx.milestone.deleteMany({
                where: { projectId: projectId }
            });

            // Delete blockers
            await tx.blocker.deleteMany({
                where: { projectId: projectId }
            });

            // Delete teams
            await tx.team.deleteMany({
                where: { projectId: projectId }
            });
            
            // Finally, delete the project itself
            await tx.project.delete({
                where: { id: projectId }
            });
        });

        revalidatePath('/projects');
        revalidatePath('/dashboard');
        revalidatePath('/gantt');
        revalidatePath('/milestones');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete project:", error);
        return { success: false, error: "Failed to delete project. Please ensure all related items are handled." };
    }
}
