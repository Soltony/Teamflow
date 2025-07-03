
import prisma from "@/lib/db";
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectButton } from "@/components/projects/create-project-button";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: {
      status: true,
      milestones: {
        include: {
          tasks: true,
        },
      },
    },
    orderBy: {
      name: 'asc'
    }
  });

  const serializableProjects = JSON.parse(JSON.stringify(projects));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Projects</CardTitle>
            <CardDescription>A list of all projects in the system. Select a project to view its details.</CardDescription>
          </div>
          <CreateProjectButton />
        </CardHeader>
        <CardContent>
          {serializableProjects.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {serializableProjects.map((project: any) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No projects found. Get started by creating a new one.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
