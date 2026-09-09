
'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { Initiative } from '@prisma/client';
import { requirePermission } from "@/lib/auth/guard";
import { serialize } from '@/lib/serialize';

export async function getInitiativesData() {
    await requirePermission('initiatives:read');
  const initiatives = await prisma.initiative.findMany({
    orderBy: {
      name: 'asc',
    },
  });
  return serialize(initiatives);
}

export async function createInitiative(data: { name: string }) {
    await requirePermission('initiatives:create');
    if (!data.name.trim()) {
        return { success: false, error: "Initiative name cannot be empty." };
    }
    try {
        await prisma.initiative.create({
            data,
        });
        revalidatePath('/initiatives');
        revalidatePath('/projects');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create initiative. An initiative with this name may already exist." };
    }
}

export async function updateInitiative(id: string, data: { name: string }) {
    await requirePermission('initiatives:update');
    if (!data.name.trim()) {
        return { success: false, error: "Initiative name cannot be empty." };
    }
    try {
        await prisma.initiative.update({ where: { id }, data });
        revalidatePath('/initiatives');
        revalidatePath('/projects');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update initiative." };
    }
}

export async function deleteInitiative(id: string) {
    await requirePermission('initiatives:delete');
    try {
        // Refused rather than silently detached. The foreign key is
        // ON DELETE SET NULL, so deleting an initiative with projects under it
        // would quietly strip the initiative from each of them and there would
        // be nothing left to say what happened.
        const projectsUnderInitiative = await prisma.project.count({
            where: { initiativeId: id }
        });
        if (projectsUnderInitiative > 0) {
            return {
                success: false,
                error: `Cannot delete this initiative: ${projectsUnderInitiative} project${projectsUnderInitiative === 1 ? ' is' : 's are'} delivered under it. Move them to another initiative first.`,
            };
        }

        await prisma.initiative.delete({ where: { id } });

        revalidatePath('/initiatives');
        revalidatePath('/projects');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete initiative:', error);
        return { success: false, error: 'Failed to delete initiative. It might be in use in other parts of the system.' };
    }
}
