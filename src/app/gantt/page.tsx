
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProjectsGanttChart } from "@/components/gantt/projects-gantt-chart";

export default function GanttPage() {
  return (
    <div className="p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects Gantt Chart</CardTitle>
          <CardDescription>A timeline view of all projects. Click on a project name to view its details.</CardDescription>
        </CardHeader>
        <CardContent>
            <ProjectsGanttChart />
        </CardContent>
      </Card>
    </div>
  );
}
