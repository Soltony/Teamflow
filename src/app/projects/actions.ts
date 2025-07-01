
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

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
    const { assignedUserIds, status, ...taskData } = data;
    
    const prismaStatus = status?.replace('-', '_').toUpperCase();

    await prisma.task.update({
        where: { id: taskId },
        data: {
            ...taskData,
            status: prismaStatus,
            assignees: assignedUserIds ? {
                set: assignedUserIds.map((id:string) => ({ id }))
            } : undefined,
        }
    });
    revalidatePath(`/projects/${projectId}/milestones`);
}
