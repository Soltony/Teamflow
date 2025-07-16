
'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { Department } from '@prisma/client';

export async function getDepartmentsData() {
  const departments = await prisma.department.findMany({
    orderBy: {
      name: 'asc',
    },
  });
  return JSON.parse(JSON.stringify(departments));
}

export async function createDepartment(data: Omit<Department, 'id'>) {
    if (!data.name.trim()) {
        return { success: false, error: "Department name cannot be empty." };
    }
    try {
        await prisma.department.create({
            data,
        });
        revalidatePath('/departments');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create department. A department with this name may already exist." };
    }
}

export async function updateDepartment(id: string, data: Omit<Department, 'id'>) {
    if (!data.name.trim()) {
        return { success: false, error: "Department name cannot be empty." };
    }
    try {
        await prisma.department.update({ where: { id }, data });
        revalidatePath('/departments');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update department." };
    }
}

export async function deleteDepartment(id: string) {
    try {
        const milestonesWithDept = await prisma.milestone.count({
            where: {
                responsibleDepartments: {
                    some: { id: id }
                }
            }
        });

        if (milestonesWithDept > 0) {
            return { success: false, error: "Cannot delete department as it is responsible for one or more milestones." };
        }
        
        await prisma.department.delete({ where: { id } });

        revalidatePath('/departments');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete department:', error);
        return { success: false, error: 'Failed to delete department.' };
    }
}
