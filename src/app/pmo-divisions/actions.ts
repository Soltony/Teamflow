
'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { PmoDivision } from '@prisma/client';

export async function getPmoDivisionsData() {
  const pmoDivisions = await prisma.pmoDivision.findMany({
    orderBy: {
      name: 'asc',
    },
  });
  return JSON.parse(JSON.stringify(pmoDivisions));
}

export async function createPmoDivision(data: Omit<PmoDivision, 'id' | 'createdAt' | 'updatedAt'>) {
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
        return { success: false, error: "Failed to create PMO division. A division with this name may already exist." };
    }
}

export async function updatePmoDivision(id: string, data: Omit<PmoDivision, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!data.name.trim()) {
        return { success: false, error: "Division name cannot be empty." };
    }
    try {
        await prisma.pmoDivision.update({ where: { id }, data });
        revalidatePath('/pmo-divisions');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update PMO division." };
    }
}

export async function deletePmoDivision(id: string) {
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
        console.error('Failed to delete PMO division:', error);
        return { success: false, error: 'Failed to delete PMO division. It might be in use in other parts of the system (e.g., by users).' };
    }
}
