
'use server';

import prisma from "@/lib/db";
import { notifyMany } from "@/lib/notifications/notify";
import { revalidatePath } from "next/cache";
import type { Task, User, TaskStatus, TaskUpdate } from "@/lib/types";
import { isToday, parseISO } from "date-fns";
import { requirePermission, requireUser } from "@/lib/auth/guard";
import { serialize } from "@/lib/serialize";
import { USER_DISPLAY_SELECT } from '@/lib/queries/user-select';

export type UserTask = Task & {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
};

/** Identity comes from the session; `_userId` is ignored (see archive/actions.ts). */
export async function getMyTasks(_userId?: string) {
  const userId = (await requirePermission('my-tasks:view')).id;

  // Only the fields the task UI renders. The full user records, including
  // every colleague's email and phone number, used to be sent to the browser.
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, avatar: true, email: true },
  });

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
          author: { select: USER_DISPLAY_SELECT },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      assignees: { select: USER_DISPLAY_SELECT },
    },
    orderBy: {
        createdAt: 'desc'
    }
  });

  const userTasks = assignedTasks.map(task => ({
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
    updatedAt: task.updatedAt,
  }));
  
  const todaysTasksCount = userTasks.filter(task => task.status !== 'DONE' && isToday(new Date(task.endDate))).length;

  return {
    userTasks: serialize(userTasks),
    allUsers: serialize(allUsers),
    todaysTasksCount,
  };
}


/**
 * Lets an assignee move their own task between TODO and IN_PROGRESS.
 *
 * DONE is deliberately not reachable here. This action previously accepted any
 * status with no authorization at all, which meant a member could mark their
 * own work complete and skip the PENDING_REVIEW approval entirely — the review
 * gate existed but was optional in practice. Completion now only happens
 * through the approval actions.
 */
export async function updateTaskStatusAction(taskId: string, newStatus: TaskStatus) {
  try {
    const user = await requireUser();

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assignees: { select: { id: true } } },
    });
    if (!task) {
      return { success: false, error: "Task not found." };
    }
    if (!task.assignees.some((a) => a.id === user.id)) {
      return { success: false, error: "You can only update tasks assigned to you." };
    }
    if (newStatus === 'DONE' || newStatus === 'PENDING_REVIEW') {
      return {
        success: false,
        error:
          "Submit a progress update instead — completion has to be approved by your team lead.",
      };
    }

    const dataToUpdate: {
      status: TaskStatus;
      completedAt?: Date | null;
      progress?: number;
    } = {
      status: newStatus,
    };

    // Only TODO and IN_PROGRESS reach here; DONE and PENDING_REVIEW are
    // rejected above because they are approval outcomes, not self-service
    // transitions.
    dataToUpdate.completedAt = null;
    if (newStatus === 'TODO') {
      dataToUpdate.progress = 0;
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

export async function addTaskUpdateAction(taskId: string, text: string, _authorId: string | undefined, progressPercentage: number) {
    try {
        const author = await requireUser();
        const authorId = author.id;

        if (!Number.isFinite(progressPercentage) || progressPercentage < 0 || progressPercentage > 100) {
            return { success: false, error: "Progress must be between 0 and 100." };
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                assignees: { select: { id: true } },
                milestone: {
                    include: {
                        project: {
                            include: {
                                projectManager: { select: USER_DISPLAY_SELECT },
                                teamLinks: {
                                    select: { team: { select: { teamLeadId: true } } },
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
        if (!task.assignees.some(a => a.id === authorId)) {
            return { success: false, error: "You can only report progress on tasks assigned to you." };
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
        // Reaches through the join, because a team can now serve several
        // projects and is no longer a direct child of one.
        project.teamLinks.forEach(link => {
            if (link.team.teamLeadId) {
                recipients.add(link.team.teamLeadId);
            }
        });
        
        // 3. Approvers for this project's EPMO division.
        //    This used to notify every holder of 'tasks:approve' in the bank,
        //    which both buried real approvals in noise and told people outside
        //    the project what its tasks were called.
        const approvers = await prisma.user.findMany({
            where: {
                pmoDivisionId: project.pmoDivisionId,
                roles: { some: { permissions: { has: 'tasks:approve' } } },
            },
            select: { id: true }
        });
        approvers.forEach(approver => recipients.add(approver.id));


        const message = `Progress on task "${task.title}" was updated to ${progressPercentage}%. It is now pending your review.`;
        const link = `/tasks/${task.id}`;

        // One insert regardless of how many people are watching the task.
        // notifyMany drops the author and deduplicates: a division approver who
        // is also an assignee is one person, not two notifications.
        await notifyMany(prisma, { message, link, senderId: authorId }, recipients);
        
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
