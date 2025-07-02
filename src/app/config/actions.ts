
'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

// User Role Management
export async function assignRoleToUser(userId: string, roleId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          connect: { id: roleId },
        },
      },
    });
    revalidatePath('/config');
    return { success: true };
  } catch (error) {
    console.error('Failed to assign role:', error);
    return { success: false, error: 'Failed to assign role.' };
  }
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          disconnect: { id: roleId },
        },
      },
    });
    revalidatePath('/config');
    return { success: true };
  } catch (error) {
    console.error('Failed to remove role:', error);
    return { success: false, error: 'Failed to remove role.' };
  }
}

// Role CRUD
type RoleData = {
  name: string;
  description: string;
  permissions: string[];
};

export async function createRole(data: RoleData) {
  try {
    await prisma.role.create({ data });
    revalidatePath('/config');
    return { success: true };
  } catch (error) {
    console.error('Failed to create role:', error);
    return { success: false, error: 'Failed to create role. Name may already exist.' };
  }
}

export async function updateRole(id: string, data: RoleData) {
  try {
    await prisma.role.update({ where: { id }, data });
    revalidatePath('/config');
    return { success: true };
  } catch (error) {
    console.error('Failed to update role:', error);
    return { success: false, error: 'Failed to update role.' };
  }
}

export async function deleteRole(id: string) {
  try {
    const usersWithRole = await prisma.user.count({
      where: { roles: { some: { id } } },
    });
    if (usersWithRole > 0) {
      return { success: false, error: 'Cannot delete role as it is currently assigned to users.' };
    }
    await prisma.role.delete({ where: { id } });
    revalidatePath('/config');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete role:', error);
    return { success: false, error: 'Failed to delete role.' };
  }
}
