
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Task, TaskUpdate } from "@/lib/types";
import { TaskStatus, TaskUpdateType } from "@prisma/client";

const statusMap: Record<Task['status'], TaskStatus> = {
    'todo': TaskStatus.TODO,
    'in-progress': TaskStatus.IN_PROGRESS,
    'pending-review': TaskStatus.PENDING_REVIEW,
    'done': TaskStatus.DONE
};

export async function updateTaskStatusAction(taskId: string, newStatus: Task['status']) {
  const prismaStatus = statusMap[newStatus];

  if (!prismaStatus) {
      return { success: false, error: "Invalid task status." };
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
                    type: TaskUpdateType.COMMENT,
                }
            });

            if (task.status === TaskStatus.IN_PROGRESS) {
                await tx.task.update({
                    where: { id: taskId },
                    data: { status: TaskStatus.PENDING_REVIEW }
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
