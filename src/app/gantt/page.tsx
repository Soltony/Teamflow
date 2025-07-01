
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProjectsGanttChart } from "@/components/gantt/projects-gantt-chart";
import prisma from "@/lib/db";

export default async function GanttPage() {
  const projects = await prisma.project.findMany({
    include: {
        milestones: {
            orderBy: {
                startDate: 'asc'
            }
        }
    },
    orderBy: {
      startDate: 'asc'
    }
  });

  return (
    <div className="p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects Gantt Chart</CardTitle>
          <CardDescription>A timeline view of all project milestones. Click on a milestone to view its project details.</CardDescription>
        </CardHeader>
        <CardContent>
            <ProjectsGanttChart projects={JSON.parse(JSON.stringify(projects))} />
        </CardContent>
      </Card>
    </div>
  );
}
