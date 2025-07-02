
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Task, User, TaskStatus, TaskUpdate } from "@/lib/types";

export type UserTask = Task & {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
};

export async function getMyTasks(userId: string) {
  const allUsers = await prisma.user.findMany();

  const assignedTasks = await prisma.task.findMany({
    where: {
      assignees: {
        some: {
          id: userId,
        },
      },
    },
    include: {
      milestone: {
        select: {
          id: true,
          title: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      updates: {
        include: {
          author: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      assignees: true,
    },
    orderBy: {
        endDate: 'asc'
    }
  });

  const userTasks: UserTask[] = assignedTasks.map(task => ({
    ...task,
    status: task.status as TaskStatus,
    projectId: task.milestone.project.id,
    projectName: task.milestone.project.name,
    milestoneId: task.milestone.id,
    milestoneTitle: task.milestone.title,
    updates: task.updates.map(u => ({...u, author: u.author as User, type: u.type as TaskUpdate['type'] })),
    assignedUserIds: task.assignees.map(a => a.id),
  }));

  return {
    userTasks: JSON.parse(JSON.stringify(userTasks)),
    allUsers: JSON.parse(JSON.stringify(allUsers))
  };
}


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
