import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { ProjectView } from "@/components/projects/project-view";

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const project = projects.find((p) => p.id === params.id);

  if (!project) {
    notFound();
  }

  return <ProjectView initialProject={project} />;
}
