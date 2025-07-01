import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { ProjectMilestones } from "@/components/projects/project-milestones";

export default function ProjectMilestonesPage({ params }: { params: { id: string } }) {
  const project = projects.find((p) => p.id === params.id);

  if (!project) {
    notFound();
  }

  return <ProjectMilestones initialProject={project} />;
}
