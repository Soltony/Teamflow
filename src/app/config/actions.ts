
'use server';

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

export async function createUser(data: { firstName: string, lastName: string, email?: string | null, phoneNumber: string, roleIds: string[] }) {
    try {
        if (data.email) {
            const existingUser = await prisma.user.findUnique({
                where: { email: data.email }
            });

            if (existingUser) {
                return { success: false, error: "A user with this email already exists." };
            }
        }

        await prisma.user.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                name: `${data.firstName} ${data.lastName}`,
                email: data.email || null,
                phoneNumber: data.phoneNumber,
                roles: {
                    connect: data.roleIds.map(id => ({ id }))
                }
            }
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to create user:", error);
        return { success: false, error: 'Failed to create user.' };
    }
}

export async function deleteUser(userId: string) {
    try {
        await prisma.user.delete({
            where: { id: userId },
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user:", error);
        return { success: false, error: "Failed to delete user. They may be associated with projects, tasks, or teams. Please reassign their responsibilities before deleting." };
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
