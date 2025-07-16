'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getResponsibleDepartmentsData() {
  const departments = await prisma.department.findMany({
    include: {
      projects: {
        include: {
          status: true,
          owningDepartment: true,
          milestones: {
            include: {
              tasks: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });
  return JSON.parse(JSON.stringify(departments));
}

export async function createDepartmentSimple(name: string) {
    if (!name.trim()) {
        return { success: false, error: "Department name cannot be empty." };
    }
    try {
        await prisma.department.create({
            data: { 
                name,
                // Providing default placeholder values for other required fields
                responsibleName: 'N/A',
                responsibleTitle: 'N/A',
                responsiblePhone: 'N/A',
            },
        });
        revalidatePath('/responsible-departments');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create department. A department with this name may already exist." };
    }
}

export async function updateDepartmentName(id: string, name: string) {
    if (!name.trim()) {
        return { success: false, error: "Department name cannot be empty." };
    }
    try {
        await prisma.department.update({ where: { id }, data: { name } });
        revalidatePath('/responsible-departments');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update department." };
    }
}

export async function deleteDepartmentAndUnlinkProjects(id: string) {
    try {
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