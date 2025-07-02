
import { MyTasksManagement } from "@/components/tasks/my-tasks-management";
import prisma from "@/lib/db";
import type { Task, User, TaskStatus, TaskUpdate } from "@/lib/types";
import { notFound } from "next/navigation";

// Define a more detailed type for tasks that includes project/milestone info
export type UserTask = Task & {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
};

export default async function MyTasksPage() {
  // In a real application, this would come from an authentication context.
  const currentUserId = 'user-1';

  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
  });

  if (!currentUser) {
    notFound();
  }

  const allUsers = await prisma.user.findMany();

  const assignedTasks = await prisma.task.findMany({
    where: {
      assignees: {
        some: {
          id: currentUserId,
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

  return (
    <MyTasksManagement
      allUsers={JSON.parse(JSON.stringify(allUsers))}
      currentUser={JSON.parse(JSON.stringify(currentUser))}
      initialTasks={JSON.parse(JSON.stringify(userTasks))}
    />
  );
}
