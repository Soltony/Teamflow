'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { Department } from '@prisma/client';

export async function getResponsibleDepartmentsData() {
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
        revalidatePath('/responsible-departments');
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
        revalidatePath('/responsible-departments');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update department." };
    }
}

export async function deleteDepartment(id: string) {
    try {
         const projectsWithDept = await prisma.project.count({ where: { departmentId: id }});
        if (projectsWithDept > 0) {
            return { success: false, error: "Cannot delete department as it is set as the owning department for one or more projects."};
        }
        
        await prisma.$transaction(async (tx) => {
            // Unlink from responsibleForMilestones (many-to-many)
            await tx.milestone.updateMany({
                where: {
                    responsibleDepartments: {
                        some: { id: id }
                    }
                },
                data: {
                    responsibleDepartments: {
                        disconnect: { id: id }
                    }
                }
            });
            
            // Delete the department itself
            await tx.department.delete({ where: { id } });
        });

        revalidatePath('/responsible-departments');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete department:', error);
        return { success: false, error: 'Failed to delete department. It might be in use in other parts of the system (e.g., by users).' };
    }
}
