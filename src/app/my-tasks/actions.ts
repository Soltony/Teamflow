
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Task, User, TaskStatus, TaskUpdate } from "@/lib/types";
import { isToday, parseISO } from "date-fns";

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
          createdAt: 'desc',
        },
      },
      assignees: true,
    },
    orderBy: {
        createdAt: 'desc'
    }
  });

  const userTasks: UserTask[] = assignedTasks.map(task => ({
    ...task,
    status: task.status as TaskStatus,
    projectId: task.milestone.project.id,
    projectName: task.milestone.project.name,
    milestoneId: task.milestone.id,
    milestoneTitle: task.milestone.title,
    updates: task.updates.map(u => ({...u, author: u.author as User, type: u.type as TaskUpdate['type'], progressPercentage: u.progressPercentage, createdAt: u.createdAt, updatedAt: u.updatedAt})),
    assignedUserIds: task.assignees.map(a => a.id),
    createdAt: task.createdAt,
    endDate: task.endDate,
    startDate: task.startDate,
    completedAt: task.completedAt,
    weight: task.weight,
    progress: task.progress,
    description: task.description,
    milestoneId: task.milestoneId,
    updatedAt: task.updatedAt,
  }));
  
  const todaysTasksCount = userTasks.filter(task => task.status !== 'DONE' && isToday(new Date(task.endDate))).length;

  return {
    userTasks: JSON.parse(JSON.stringify(userTasks)),
    allUsers: JSON.parse(JSON.stringify(allUsers)),
    todaysTasksCount,
  };
}


export async function updateTaskStatusAction(taskId: string, newStatus: TaskStatus) {
  try {
    const dataToUpdate: {
      status: TaskStatus;
      completedAt?: Date | null;
      progress?: number;
    } = {
      status: newStatus,
    };

    if (newStatus === 'DONE') {
      dataToUpdate.completedAt = new Date();
      dataToUpdate.progress = 100;
    } else if (newStatus === 'TODO') {
      dataToUpdate.completedAt = null;
      dataToUpdate.progress = 0;
    } else if (newStatus === 'IN_PROGRESS' || newStatus === 'PENDING_REVIEW') {
      dataToUpdate.completedAt = null;
    }

    await prisma.task.update({
      where: { id: taskId },
      data: dataToUpdate,
    });

    revalidatePath('/my-tasks');
    return { success: true };
  } catch (error) {
    console.error("Failed to update task status:", error);
    return { success: false, error: "Failed to update task status." };
  }
}

export async function addTaskUpdateAction(taskId: string, text: string, authorId: string, progressPercentage: number) {
    try {
        const task = await prisma.task.findUnique({ 
            where: { id: taskId },
            include: {
                milestone: {
                    include: {
                        project: {
                            include: {
                                projectManager: true,
                                teams: {
                                    include: {
                                        teamLead: true
                                    }
                                },
                            }
                        }
                    }
                }
            }
        });
        if (!task) {
            throw new Error("Task not found.");
        }
        
        await prisma.taskUpdate.create({
            data: {
                text,
                authorId,
                taskId: taskId,
                type: 'COMMENT',
                progressPercentage,
            }
        });

        const updates: any = {
            progress: progressPercentage,
            status: 'PENDING_REVIEW'
        };
        
        await prisma.task.update({
            where: { id: taskId },
            data: updates
        });
        
        // --- Notification Logic ---
        const project = task.milestone.project;
        const recipients = new Set<string>();

        // 1. Add Project Manager
        if (project.projectManagerId) {
            recipients.add(project.projectManagerId);
        }
        
        // 2. Add Team Leads
        project.teams.forEach(team => {
            if (team.teamLeadId) {
                recipients.add(team.teamLeadId);
            }
        });
        
        // 3. Add users with 'tasks:approve' permission (includes Directors, Admins)
        const approvers = await prisma.user.findMany({
            where: {
                roles: {
                    some: {
                        permissions: {
                            has: 'tasks:approve'
                        }
                    }
                }
            },
            select: { id: true }
        });
        approvers.forEach(approver => recipients.add(approver.id));
        

        const message = `Progress on task "${task.title}" was updated to ${progressPercentage}%. It is now pending your review.`;
        const link = `/tasks/${task.id}`;

        for (const recipientId of recipients) {
            if (recipientId !== authorId) { // Don't notify the user who made the update
                await prisma.notification.create({
                    data: {
                        message,
                        link,
                        recipientId,
                        senderId: authorId
                    }
                });
            }
        }
        
        revalidatePath('/my-tasks');
        revalidatePath('/team-view');
        revalidatePath('/task-approvals');
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error("Failed to add task update:", error);
        return { success: false, error: "Failed to add task update." };
    }
}
