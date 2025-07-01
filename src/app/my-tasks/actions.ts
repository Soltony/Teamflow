'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Task, TaskUpdate } from "@/lib/types";

export async function updateTaskStatusAction(taskId: string, newStatus: Task['status']) {
  const updateData: { status: Task['status'], completedAt?: string } = {
    status: newStatus
  };

  if (newStatus === 'done') {
    updateData.completedAt = new Date().toISOString();
  }

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });
    revalidatePath('/my-tasks');
    return { success: true };
  } catch (error) {
    console.error("Failed to update task status:", error);
    return { success: false, error: "Failed to update task status." };
  }
}

export async function addTaskUpdateAction(taskId: string, text: string, userId: string) {
    try {
        await prisma.$transaction(async (tx) => {
            const task = await tx.task.findUnique({ where: { id: taskId } });
            if (!task) {
                throw new Error("Task not found.");
            }

            const newUpdate: Omit<TaskUpdate, 'id'> = {
                text,
                userId,
                createdAt: new Date().toISOString(),
                type: 'comment',
            };
            
            await tx.taskUpdate.create({
                data: {
                    ...newUpdate,
                    taskId: taskId,
                }
            });

            // If task was in-progress (e.g., after being declined), resubmit for review.
            if (task.status === 'in-progress') {
                await tx.task.update({
                    where: { id: taskId },
                    data: { status: 'pending-review' }
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