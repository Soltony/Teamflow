
'use server';
<<<<<<< HEAD
=======

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function assignRolesToUser(userId: string, roleIds: string[]) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                roles: {
                    set: roleIds.map(id => ({ id })),
                }
            }
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to assign roles to user:", error);
        return { success: false, error: 'Failed to assign roles.' };
    }
}

export async function createRole(data: { name: string, description?: string, permissions?: string[] }) {
    try {
        await prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
                permissions: data.permissions
            }
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to create role:", error);
        return { success: false, error: 'A role with this name may already exist.' };
    }
}

export async function updateRole(id: string, data: { name: string, description?: string, permissions?: string[] }) {
    try {
        await prisma.role.update({
            where: { id },
            data
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to update role:", error);
        return { success: false, error: 'Failed to update role.' };
    }
}

export async function deleteRole(id: string) {
    try {
        const usersWithRole = await prisma.user.count({
            where: { roles: { some: { id } } }
        });
        if (usersWithRole > 0) {
            return { success: false, error: 'Cannot delete role as it is currently assigned to one or more users.' };
        }
        await prisma.role.delete({ where: { id } });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete role:", error);
        return { success: false, error: 'Failed to delete role.' };
    }
}
>>>>>>> d1997e7eced32ba05aee3b3f4b5b652fab47b1f8
