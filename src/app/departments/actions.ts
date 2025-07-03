'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { Department } from '@prisma/client';

type DepartmentData = Omit<Department, 'id'>;

export async function getDepartments() {
    const departments = await prisma.department.findMany({
        orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(departments));
}

export async function createDepartment(data: DepartmentData) {
    try {
        await prisma.department.create({ data });
        revalidatePath('/departments');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create department. A department with this name may already exist." };
    }
}

export async function updateDepartment(id: string, data: DepartmentData) {
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
        const projectsWithDept = await prisma.project.count({ where: { departmentId: id }});
        if (projectsWithDept > 0) {
            return { success: false, error: "Cannot delete department as it is set as the owning department for one or more projects."};
        }
        await prisma.department.delete({ where: { id } });
        revalidatePath('/departments');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete department." };
    }
}
