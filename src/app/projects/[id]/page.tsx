
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/projects/project-view";
import prisma from "@/lib/db";
import { BlockerStatus, Task, TaskStatus } from "@/lib/types";

export default async function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      status: true,
      owningDepartment: true,
      projectManager: true,
      blockers: true,
      milestones: {
        include: {
          tasks: {
            include: {
              assignees: true,
              updates: true,
            }
          }
        }
      }
    }
  });

  if (!project) {
    notFound();
  }

  // Normalize data before sending to client
  const normalizedProject = {
    ...project,
    milestones: project.milestones.map(m => ({
      ...m,
      tasks: m.tasks.map(t => ({
        ...t,
        status: t.status as TaskStatus,
        assignedUserIds: t.assignees.map(a => a.id),
      }))
    })),
    blockers: project.blockers.map(b => ({
        ...b,
        status: b.status as BlockerStatus,
    }))
  }

  return <ProjectView initialProject={JSON.parse(JSON.stringify(normalizedProject))} />;
}
