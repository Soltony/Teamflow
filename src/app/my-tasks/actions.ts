
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@/lib/types";

export async function updateTaskStatusAction(taskId: string, newStatus: TaskStatus) {
  try {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        completedAt: newStatus === 'DONE' ? new Date() : null
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
