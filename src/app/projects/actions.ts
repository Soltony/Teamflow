

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
    const { milestones, responsibleDepartmentIds, hasCost, payments, hasMilestones, ...projectData } = data;

    const newProject = await prisma.project.create({
        data: {
            ...projectData,
            totalCost: hasCost ? new Decimal(projectData.totalCost || 0) : null,
            currency: projectData.currency,
            responsibleDepartments: {
                connect: responsibleDepartmentIds.map((id: string) => ({ id }))
            },
            milestones: hasMilestones && milestones ? {
                create: milestones.map((m: any) => ({
                    title: m.title,
                    description: m.description,
                    startDate: m.startDate,
                    dueDate: m.dueDate,
                    weight: m.weight,
                }))
            } : undefined,
            payments: hasCost && payments ? {
                create: payments.map((p: any) => ({
                    title: p.title,
                    description: p.description,
                    amount: new Decimal(p.amount || 0),
                    paymentDate: p.paymentDate,
                    status: 'PENDING',
                }))
            } : undefined,
        },
        include: {
            milestones: true,
            payments: true,
        }
    });

    revalidatePath('/dashboard');
    revalidatePath('/projects');
    revalidatePath('/gantt');
    revalidatePath('/payments');
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
                },
                payments: true,
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
        hasMilestones: project.milestones.length > 0,
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
    const { milestones, responsibleDepartmentIds, hasCost, payments, timelineChangeReason, hasMilestones, ...projectData } = data;

    const existingProject = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existingProject) {
        return { success: false, error: 'Project not found.' };
    }

    const endDateChanged = new Date(projectData.endDate).getTime() !== new Date(existingProject.endDate).getTime();

    if (endDateChanged && !timelineChangeReason) {
        return { success: false, error: 'A reason for changing the project deadline is required.' };
    }

    const existingMilestones = await prisma.milestone.findMany({
        where: { projectId: projectId },
        select: { id: true }
    });
    const existingMilestoneIds = existingMilestones.map(m => m.id);

    const incomingMilestoneIds = hasMilestones && milestones ? milestones.filter((m: any) => m.id).map((m: any) => m.id) : [];
    
    const existingPayments = await prisma.payment.findMany({
        where: { projectId: projectId },
        select: { id: true }
    });
    const existingPaymentIds = existingPayments.map(p => p.id);

    const incomingPaymentIds = payments ? payments.filter((p: any) => p.id).map((p: any) => p.id) : [];
    const paymentIdsToDelete = existingPaymentIds.filter((id: string) => !incomingPaymentIds.includes(id));

    try {
        const completedStatus = await prisma.projectStatus.findUnique({
            where: { name: 'Completed' },
            select: { id: true }
        });
        const isCompletingProject = completedStatus && projectData.statusId === completedStatus.id;

        await prisma.$transaction(async (tx) => {
            // --- PAYMENT SYNC ---
            if (paymentIdsToDelete.length > 0) {
                await tx.payment.deleteMany({
                    where: { id: { in: paymentIdsToDelete } }
                });
            }
            
            // --- TIMELINE CHANGE REQUEST ---
            if (endDateChanged) {
                await tx.timelineChangeRequest.create({
                    data: {
                        projectId: projectId,
                        oldEndDate: existingProject.endDate,
                        newEndDate: projectData.endDate,
                        reason: timelineChangeReason,
                        requestedById: projectData.projectManagerId, // Or whoever is making the request
                        status: 'PENDING',
                    }
                });
            }

            // --- PROJECT UPDATE ---
            await tx.project.update({
                where: { id: projectId },
                data: {
                  name: projectData.name,
                  description: projectData.description,
                  startDate: projectData.startDate,
                  // endDate is NOT updated here directly anymore if a change is requested.
                  // It will be updated upon approval. If no change, it remains the same.
                  endDate: endDateChanged ? existingProject.endDate : projectData.endDate,
                  statusId: projectData.statusId,
                  pmoDivisionId: projectData.pmoDivisionId,
                  projectManagerId: projectData.projectManagerId,
                  workingYear: projectData.workingYear,
                  currency: projectData.currency,
                  totalCost: hasCost ? new Decimal(projectData.totalCost || 0) : null,
                  responsibleDepartments: {
                    set: responsibleDepartmentIds.map((id: string) => ({ id }))
                  }
                }
            });

            if (hasMilestones && milestones) {
                 for (const milestone of milestones) {
                    const { id, ...milestoneData } = milestone;
                    
                    const dataForUpsert = {
                        title: milestoneData.title,
                        description: milestoneData.description,
                        startDate: milestoneData.startDate,
                        dueDate: milestoneData.dueDate,
                        weight: milestoneData.weight,
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
            } else if (!hasMilestones) { // if hasMilestones is false, delete all existing milestones
                const milestonesToDelete = await tx.milestone.findMany({
                    where: { projectId },
                    select: { id: true },
                });
                const milestoneIdsToDelete = milestonesToDelete.map(m => m.id);

                if (milestoneIdsToDelete.length > 0) {
                    // Find all tasks related to these milestones
                    const tasksToDelete = await tx.task.findMany({
                        where: { milestoneId: { in: milestoneIdsToDelete } },
                        select: { id: true },
                    });
                    const taskIdsToDelete = tasksToDelete.map(t => t.id);

                    if (taskIdsToDelete.length > 0) {
                        // Delete task updates first
                        await tx.taskUpdate.deleteMany({
                            where: { taskId: { in: taskIdsToDelete } },
                        });
                        // Then delete tasks
                        await tx.task.deleteMany({
                            where: { id: { in: taskIdsToDelete } },
                        });
                    }
                    // Finally, delete the milestones
                    await tx.milestone.deleteMany({
                        where: { id: { in: milestoneIdsToDelete } },
                    });
                }
            }
            
            // --- PAYMENT UPSERT ---
            if (hasCost && payments) {
                for (const payment of payments) {
                    const { id, ...paymentData } = payment;
                    
                    const dataForPaymentUpsert = {
                        title: paymentData.title,
                        description: paymentData.description,
                        amount: new Decimal(paymentData.amount || 0),
                        paymentDate: paymentData.paymentDate,
                    };

                    if (id) {
                        await tx.payment.update({
                            where: { id: id },
                            data: dataForPaymentUpsert
                        });
                    } else {
                        await tx.payment.create({
                            data: {
                                ...dataForPaymentUpsert,
                                status: 'PENDING', // New payments default to pending
                                project: { connect: { id: projectId } },
                            }
                        });
                    }
                }
            } else if (!hasCost) { // if hasCost is false, delete all payments
                await tx.payment.deleteMany({
                    where: { projectId }
                });
            }


            // --- PROJECT COMPLETION LOGIC ---
            if (isCompletingProject) {
                const projectTasks = await tx.task.findMany({
                    where: { milestone: { projectId: projectId } },
                    select: { id: true }
                });
                await tx.task.updateMany({
                    where: { id: { in: projectTasks.map(t => t.id) } },
                    data: {
                        status: 'DONE',
                        progress: 100,
                        completedAt: new Date(),
                    }
                });
            }
        });

        revalidatePath('/projects');
        revalidatePath(`/projects/${projectId}`);
        revalidatePath(`/projects/${projectId}/edit`);
        revalidatePath('/dashboard');
        revalidatePath('/gantt');
        revalidatePath('/milestones');
        revalidatePath('/payments');
        revalidatePath('/timeline-approvals');
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
    const newMilestone = await prisma.milestone.create({
        data: {
            ...data,
            projectId,
        }
    });
    revalidatePath(`/projects`);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, milestone: newMilestone };
}

export async function updateMilestone(milestoneId: string, projectId: string, data: any) {
    await prisma.milestone.update({
        where: { id: milestoneId },
        data
    });
    revalidatePath(`/projects`);
    revalidatePath(`/projects/${projectId}`);
}

export async function addTask(projectId: string, milestoneId: string | null, data: any) {
    const { assignedUserIds, ...taskData } = data;
    let finalMilestoneId = milestoneId;

    if (!finalMilestoneId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { milestones: true }
        });
        
        if (!project) throw new Error("Project not found");

        let generalMilestone = project.milestones.find(m => m.title === "General Tasks");

        if (!generalMilestone) {
            generalMilestone = await prisma.milestone.create({
                data: {
                    title: "General Tasks",
                    description: "A default collection of tasks for this project that are not assigned to a specific milestone.",
                    startDate: project.startDate,
                    dueDate: project.endDate,
                    weight: 0, // General milestone has no weight towards project completion
                    projectId: projectId,
                }
            });
        }
        finalMilestoneId = generalMilestone.id;
    }
    
    await prisma.task.create({
        data: {
            ...taskData,
            status: 'TODO',
            milestoneId: finalMilestoneId,
            assignees: {
                connect: assignedUserIds.map((id:string) => ({ id }))
            }
        }
    });
    revalidatePath(`/projects`);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/my-tasks');
}

export async function updateTask(taskId: string, projectId: string, data: any) {
    const { assignedUserIds, milestoneId, ...taskData } = data;
    let finalMilestoneId = milestoneId;

    // Handle the case where the task is moved to the project level (no milestone)
    if (finalMilestoneId === 'project-level') {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { milestones: true }
        });
        if (!project) throw new Error("Project not found");
        
        let generalMilestone = project.milestones.find(m => m.title === "General Tasks");
        if (!generalMilestone) {
            generalMilestone = await prisma.milestone.create({
                data: {
                    title: "General Tasks",
                    description: "A default collection of tasks for this project that are not assigned to a specific milestone.",
                    startDate: project.startDate,
                    dueDate: project.endDate,
                    weight: 0,
                    projectId: projectId,
                }
            });
        }
        finalMilestoneId = generalMilestone.id;
    }

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
    
    // Prepare the update data
    const updateData: any = {
        ...finalTaskData,
        assignees: assignedUserIds ? {
            set: assignedUserIds.map((id:string) => ({ id }))
        } : undefined,
    };

    // Only update milestone if finalMilestoneId is defined
    if (finalMilestoneId) {
        updateData.milestone = {
            connect: { id: finalMilestoneId }
        };
    }
    
    await prisma.task.update({
        where: { id: taskId },
        data: updateData
    });
    revalidatePath(`/projects`);
    revalidatePath(`/projects/${projectId}`);
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
        
        revalidatePath(`/projects`);
        if (projectId) revalidatePath(`/projects/${projectId}`);
        revalidatePath('/my-tasks');
        revalidatePath('/dashboard');
        
        return { success: true };
    } catch (error) {
        console.error("Failed to delete task:", error);
        return { success: false, error: "Failed to delete task." };
    }
}

export async function getProjectsPageData(userId: string, filters: { status?: string | null; pmoDivisionId?: string | null; }) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) {
        return {
            projects: [],
            statuses: [],
            users: [],
            pmoDivisions: [],
        };
    }
    
    const [statuses, users, pmoDivisions] = await Promise.all([
        prisma.projectStatus.findMany({ orderBy: { name: 'asc' } }),
        prisma.user.findMany({ include: { roles: true } }),
        prisma.pmoDivision.findMany({ orderBy: { name: 'asc' } }),
    ]);
    
    const archivedStatusNames = ['Completed', 'On Handover'];
    const archivedStatusIds = statuses.filter(s => archivedStatusNames.includes(s.name)).map(s => s.id);

    // Check if user has admin-level permissions (can see all projects)
    const hasAdminPermissions = user.roles.some(role => 
        role.permissions.includes('projects:read') && 
        role.permissions.includes('projects:update') && 
        role.permissions.includes('projects:delete')
    );

    let whereClause: Prisma.ProjectWhereInput = {
        statusId: {
            notIn: archivedStatusIds,
        },
        ...(filters.status && { statusId: filters.status }),
        ...(filters.pmoDivisionId && { pmoDivisionId: filters.pmoDivisionId }),
    };

    if (!hasAdminPermissions) {
        whereClause.OR = [
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
        ];
    }
    
    const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
            status: true,
            milestones: {
                include: {
                    tasks: {
                        include: {
                            assignees: true,
                        }
                    }
                }
            },
            timelineChangeRequests: {
                where: {
                    status: 'PENDING'
                }
            },
            teams: {
                include: {
                    members: true,
                    teamLead: true,
                }
            },
            blockers: {
                where: {
                    status: 'OPEN'
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return {
        projects: JSON.parse(JSON.stringify(projects)),
        statuses: JSON.parse(JSON.stringify(statuses.filter(s => !archivedStatusNames.includes(s.name)))),
        users: JSON.parse(JSON.stringify(users)),
        pmoDivisions: JSON.parse(JSON.stringify(pmoDivisions)),
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
                    },
                }
            },
            timelineChangeRequests: {
                include: {
                    requestedBy: true,
                    reviewedBy: true,
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        }
    });

    if (!project) {
        return null; // Project not found
    }

    // Check if user has admin-level permissions (can see all projects)
    const hasAdminPermissions = user.roles.some(role => 
        role.permissions.includes('projects:read') && 
        role.permissions.includes('projects:update') && 
        role.permissions.includes('projects:delete')
    );
    
    if (hasAdminPermissions) {
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

    // Check if user has admin-level permissions (can see all projects)
    const hasAdminPermissions = user.roles.some(role => 
        role.permissions.includes('projects:read') && 
        role.permissions.includes('projects:update') && 
        role.permissions.includes('projects:delete')
    );
    
    let whereClause: Prisma.ProjectWhereUniqueInput = { id: projectId };
    
    if (!hasAdminPermissions) {
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
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    tasks: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            assignees: true,
                        }
                    }
                }
            },
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
            const milestones = await tx.milestone.findMany({
                where: { projectId },
                select: { id: true }
            });
            const milestoneIds = milestones.map(m => m.id);

            if (milestoneIds.length > 0) {
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
                // Delete milestones
                await tx.milestone.deleteMany({
                    where: { id: { in: milestoneIds } }
                });
            }

            // Delete blockers
            await tx.blocker.deleteMany({
                where: { projectId: projectId }
            });

            // Delete teams
            await tx.team.deleteMany({
                where: { projectId: projectId }
            });
            
            // Delete payments
            await tx.payment.deleteMany({
                where: { projectId: projectId }
            });
            
            // Delete timeline change requests
            await tx.timelineChangeRequest.deleteMany({
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
