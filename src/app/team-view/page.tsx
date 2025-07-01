
import { TeamTasksManagement } from "@/components/tasks/team-tasks-management";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import type { Task, User, Team, ProjectStatus, TaskUpdate } from "@/lib/types";

export type TeamViewTask = Task & {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
};

export type ProjectWithTasksAndStats = {
    project: {
        id: string;
        name: string;
        statusId: string | null;
    };
    tasks: TeamViewTask[];
    stats: {
        pending: number;
        inProgress: number;
        done: number;
        todo: number;
        total: number;
    }
}

export default async function TeamViewPage() {
  const currentUserId = 'user-1'; 

  const currentUser = await prisma.user.findUnique({ where: { id: currentUserId }});
  if (!currentUser) {
      notFound();
  }
  
  const allUsers = await prisma.user.findMany();
  const projectStatuses = await prisma.projectStatus.findMany();

  const ledTeams = await prisma.team.findMany({
      where: { teamLeadId: currentUserId },
      include: { members: true }
  });

  const teamMemberIds = Array.from(new Set(ledTeams.flatMap(team => team.members.map(m => m.id))));

  if (teamMemberIds.length === 0) {
    return (
        <TeamTasksManagement 
            allUsers={JSON.parse(JSON.stringify(allUsers))}
            ledTeams={JSON.parse(JSON.stringify(ledTeams))}
            currentUser={JSON.parse(JSON.stringify(currentUser))}
            initialTasksByProject={[]}
            projectStatuses={JSON.parse(JSON.stringify(projectStatuses))}
        />
    )
  }

  const teamMemberTasks = await prisma.task.findMany({
      where: {
          assignees: {
              some: {
                  id: {
                      in: teamMemberIds,
                  }
              }
          }
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
                          status: true
                      }
                  }
              }
          },
          updates: {
              include: {
                  author: true
              },
              orderBy: {
                  createdAt: 'asc'
              }
          },
          assignees: true
      }
  });

  const tasksByProject = teamMemberTasks.reduce((acc, task) => {
      const projectId = task.milestone.project.id;
      if (!acc[projectId]) {
          acc[projectId] = {
              project: {
                  id: projectId,
                  name: task.milestone.project.name,
                  statusId: task.milestone.project.status?.id ?? null,
              },
              tasks: [],
              stats: { pending: 0, inProgress: 0, done: 0, todo: 0, total: 0 }
          };
      }
      
      const userTask: TeamViewTask = {
          ...task,
          status: task.status.replace(/_/g,'-').toLowerCase() as Task['status'],
          updates: task.updates.map(u => ({ ...u, type: u.type?.replace(/_/g,'-').toLowerCase() as TaskUpdate['type']})),
          projectId: task.milestone.project.id,
          projectName: task.milestone.project.name,
          milestoneId: task.milestone.id,
          milestoneTitle: task.milestone.title,
          assignedUserIds: task.assignees.map(a => a.id),
      };
      
      acc[projectId].tasks.push(userTask);
      acc[projectId].stats.total++;
      if (task.status === 'PENDING_REVIEW') acc[projectId].stats.pending++;
      else if (task.status === 'IN_PROGRESS') acc[projectId].stats.inProgress++;
      else if (task.status === 'DONE') acc[projectId].stats.done++;
      else if (task.status === 'TODO') acc[projectId].stats.todo++;

      return acc;
  }, {} as Record<string, ProjectWithTasksAndStats>);

  return (
    <TeamTasksManagement 
        allUsers={JSON.parse(JSON.stringify(allUsers))}
        ledTeams={JSON.parse(JSON.stringify(ledTeams))}
        currentUser={JSON.parse(JSON.stringify(currentUser))} 
        initialTasksByProject={JSON.parse(JSON.stringify(Object.values(tasksByProject)))}
        projectStatuses={JSON.parse(JSON.stringify(projectStatuses))}
    />
  );
}
