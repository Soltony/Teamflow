
'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { Department } from '@prisma/client';
import { requirePermission } from "@/lib/auth/guard";
import { serialize } from '@/lib/serialize';

export async function getDepartmentsData() {
    await requirePermission('departments:read');
  const departments = await prisma.department.findMany({
    orderBy: {
      name: 'asc',
    },
  });
  return serialize(departments);
}

export async function createDepartment(data: { name: string }) {
    await requirePermission('departments:create');
    if (!data.name.trim()) {
        return { success: false, error: "Department name cannot be empty." };
    }
    try {
        await prisma.department.create({
            data,
        });
        revalidatePath('/departments');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create department. A department with this name may already exist." };
    }
}

export async function updateDepartment(id: string, data: { name: string }) {
    await requirePermission('departments:update');
    if (!data.name.trim()) {
        return { success: false, error: "Department name cannot be empty." };
    }
    try {
        await prisma.department.update({ where: { id }, data });
        revalidatePath('/departments');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update department." };
    }
}

export async function deleteDepartment(id: string) {
    await requirePermission('departments:delete');
    try {
        const projectsWithDept = await prisma.project.count({ 
            where: { responsibleDepartments: { some: { id } } } 
        });
        if (projectsWithDept > 0) {
            return { success: false, error: "Cannot delete department as it is set as a responsible department for one or more projects."};
        }
        
        await prisma.department.delete({ where: { id } });

        revalidatePath('/departments');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete department:', error);
        return { success: false, error: 'Failed to delete department. It might be in use in other parts of the system.' };
    }
}
