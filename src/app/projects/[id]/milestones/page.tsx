
import { notFound } from "next/navigation";
import { ProjectMilestones } from "@/components/projects/project-milestones";
import prisma from "@/lib/db";
import { BlockerStatus, Task, TaskStatus } from "@/lib/types";

export default async function ProjectMilestonesPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
        milestones: {
            include: {
                tasks: {
                    include: {
                        assignees: true,
                    }
                },
                responsibleDepartments: true
            }
        }
    }
  });

  if (!project) {
    notFound();
  }
  
  const users = await prisma.user.findMany();
  const departments = await prisma.department.findMany();

  // Normalize data before sending to client
  const normalizedProject = {
    ...project,
    milestones: project.milestones.map(m => ({
      ...m,
      responsibleDepartmentIds: m.responsibleDepartments.map(d => d.id),
      tasks: m.tasks.map(t => ({
        ...t,
        status: t.status as TaskStatus,
        assignedUserIds: t.assignees.map(a => a.id),
      }))
    }))
  };

  return <ProjectMilestones 
            initialProject={JSON.parse(JSON.stringify(normalizedProject))} 
            users={JSON.parse(JSON.stringify(users))}
            departments={JSON.parse(JSON.stringify(departments))}
        />;
}
