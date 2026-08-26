
'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { PmoDivision } from '@prisma/client';
import { requirePermission } from "@/lib/auth/guard";

import { serialize } from '@/lib/serialize';
export async function getPmoDivisionsData() {
    await requirePermission('pmo-divisions:view');
  const pmoDivisions = await prisma.pmoDivision.findMany({
    orderBy: {
      name: 'asc',
    },
  });
  return serialize(pmoDivisions);
}

export async function createPmoDivision(data: Omit<PmoDivision, 'id' | 'createdAt' | 'updatedAt'>) {
    await requirePermission('pmo-divisions:create');
    if (!data.name.trim()) {
        return { success: false, error: "Division name cannot be empty." };
    }
    try {
        await prisma.pmoDivision.create({
            data,
        });
        revalidatePath('/pmo-divisions');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create EPMO division. A division with this name may already exist." };
    }
}

export async function updatePmoDivision(id: string, data: Omit<PmoDivision, 'id' | 'createdAt' | 'updatedAt'>) {
    await requirePermission('pmo-divisions:update');
    if (!data.name.trim()) {
        return { success: false, error: "Division name cannot be empty." };
    }
    try {
        await prisma.pmoDivision.update({ where: { id }, data });
        revalidatePath('/pmo-divisions');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update EPMO division." };
    }
}

export async function deletePmoDivision(id: string) {
    await requirePermission('pmo-divisions:delete');
    try {
         const projectsWithDivision = await prisma.project.count({ where: { pmoDivisionId: id }});
        if (projectsWithDivision > 0) {
            return { success: false, error: "Cannot delete division as it is set as the owning division for one or more projects."};
        }
        
        await prisma.pmoDivision.delete({ where: { id } });

        revalidatePath('/pmo-divisions');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete EPMO division:', error);
        return { success: false, error: 'Failed to delete EPMO division. It might be in use in other parts of the system (e.g., by users).' };
    }
}
