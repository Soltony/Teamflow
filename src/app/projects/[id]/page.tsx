
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/projects/project-view";
import prisma from "@/lib/db";
import { Task, TaskUpdate } from "@/lib/types";

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
        status: t.status.replace(/_/g, '-').toLowerCase() as Task['status'],
        assignedUserIds: t.assignees.map(a => a.id),
      }))
    })),
    blockers: project.blockers.map(b => ({
        ...b,
        status: b.status.toLowerCase() as 'open' | 'resolved'
    }))
  }

  return <ProjectView initialProject={JSON.parse(JSON.stringify(normalizedProject))} />;
}
