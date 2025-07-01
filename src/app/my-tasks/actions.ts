'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Task, TaskUpdate } from "@/lib/types";

export async function updateTaskStatusAction(taskId: string, newStatus: Task['status']) {
  const updateData: { status: Task['status'], completedAt?: Date } = {
    status: newStatus
  };

  const prismaStatus = newStatus.replace('-', '_').toUpperCase() as any;

  if (newStatus === 'done') {
    updateData.completedAt = new Date();
  }

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: prismaStatus,
        completedAt: newStatus === 'done' ? new Date() : undefined
      },
    });
    revalidatePath('/my-tasks');
    return { success: true };
  } catch (error) {
    console.error("Failed to update task status:", error);
    return { success: false, error: "Failed to update task status." };
  }
}

export async function addTaskUpdateAction(taskId: string, text: string, authorId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            const task = await tx.task.findUnique({ where: { id: taskId } });
            if (!task) {
                throw new Error("Task not found.");
            }
            
            await tx.taskUpdate.create({
                data: {
                    text,
                    authorId,
                    taskId: taskId,
                    type: 'COMMENT',
                }
            });

            if (task.status === 'IN_PROGRESS') {
                await tx.task.update({
                    where: { id: taskId },
                    data: { status: 'PENDING_REVIEW' }
                });
            }
        });
        
        revalidatePath('/my-tasks');
        revalidatePath('/team-view');
        return { success: true };
    } catch (error) {
        console.error("Failed to add task update:", error);
        return { success: false, error: "Failed to add task update." };
    }
}
