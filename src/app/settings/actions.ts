'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createProjectStatus(name: string) {
    if (!name || name.trim().length < 3) {
        return { success: false, error: "Status name must be at least 3 characters." };
    }
    try {
        await prisma.projectStatus.create({ data: { name } });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create status. It may already exist." };
    }
}

export async function updateProjectStatus(id: string, name: string) {
    if (!name || name.trim().length < 3) {
        return { success: false, error: "Status name must be at least 3 characters." };
    }
    try {
        await prisma.projectStatus.update({ where: { id }, data: { name } });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update status." };
    }
}

export async function deleteProjectStatus(id: string) {
    try {
        const projectsWithStatus = await prisma.project.count({ where: { statusId: id } });
        if (projectsWithStatus > 0) {
            return { success: false, error: "Cannot delete status as it is currently in use by projects." };
        }
        await prisma.projectStatus.delete({ where: { id } });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete status." };
    }
}
