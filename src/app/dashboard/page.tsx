import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import { projects } from "@/lib/data";
import { DepartmentProjectsChart } from "@/components/dashboard/department-projects-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects Dashboard</h1>
        <Button asChild>
          <Link href="/projects/new">
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Project
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Projects by Department</CardTitle>
            <CardDescription>
              Distribution of projects across departments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentProjectsChart />
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Welcome to TeamFlow!</CardTitle>
            <CardDescription>
              Your central hub for managing projects, teams, and departments
              efficiently. Get an overview of your ongoing work and create new
              projects to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use the sidebar to navigate between different sections of the
              application. You can create new projects, manage departments, and
              soon, you'll be able to manage teams and view comprehensive Gantt
              charts.
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold mt-6 mb-4">All Projects</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}