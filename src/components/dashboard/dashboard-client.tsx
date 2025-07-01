
"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { PlusCircle, CheckCircle, Clock, AlertOctagon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import { DepartmentProjectsChart } from "@/components/dashboard/department-projects-chart";
import { ProjectStatusChart } from "@/components/dashboard/project-status-chart";
import { ResponsibleDepartmentChart } from "@/components/dashboard/responsible-department-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const StatCardWrapper = ({ children, count, href }: { children: React.ReactNode, count: number, href: string }) => {
  if (count > 0) {
    return <Link href={href}>{children}</Link>;
  }
  return <>{children}</>;
};

export function DashboardClient({ projects, projectStatuses, departments, availableYears, selectedYear, stats }: any) {
  const router = useRouter();
  const pathname = usePathname();

  const handleYearChange = (year: string) => {
    const params = new URLSearchParams();
    if (year !== "all") {
      params.set("year", year);
    }
    // A full page refresh is better to ensure the server component re-fetches.
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Projects Dashboard</h1>
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year: string) => (
                <SelectItem key={year} value={year}>
                  {year === 'all' ? 'All Years' : year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Project
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Welcome to TeamFlow!</CardTitle>
            <CardDescription>
              Your central hub for managing projects, teams, and departments
              efficiently.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get an overview of your ongoing work and create new projects to get started. Use the charts to see how projects are distributed.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCardWrapper count={stats.onTimeProjectsCount} href={`/reports?type=on-time&year=${selectedYear}`}>
          <Card className={stats.onTimeProjectsCount > 0 ? 'hover:bg-muted transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Completion</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.onTimeProjectsCount}</div>
              <p className="text-xs text-muted-foreground">projects completed on schedule</p>
            </CardContent>
          </Card>
        </StatCardWrapper>
        
        <StatCardWrapper count={stats.lateProjectsCount} href={`/reports?type=late&year=${selectedYear}`}>
          <Card className={stats.lateProjectsCount > 0 ? 'hover:bg-muted transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late Completion</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.lateProjectsCount}</div>
              <p className="text-xs text-muted-foreground">projects completed after schedule</p>
            </CardContent>
          </Card>
        </StatCardWrapper>

        <StatCardWrapper count={stats.overdueProjectsCount} href={`/reports?type=overdue&year=${selectedYear}`}>
          <Card className={stats.overdueProjectsCount > 0 ? 'hover:bg-muted transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Projects</CardTitle>
              <AlertOctagon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overdueProjectsCount}</div>
              <p className="text-xs text-muted-foreground">active projects past their deadline</p>
            </CardContent>
          </Card>
        </StatCardWrapper>

        <StatCardWrapper count={stats.totalBlockersCount} href={`/reports?type=active-blockers&year=${selectedYear}`}>
          <Card className={stats.totalBlockersCount > 0 ? 'hover:bg-muted transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Blockers</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBlockersCount}</div>
              <p className="text-xs text-muted-foreground">issues requiring attention</p>
            </CardContent>
          </Card>
        </StatCardWrapper>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Projects by Owning Department</CardTitle>
            <CardDescription>
              Distribution of projects across owning departments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentProjectsChart projects={projects} departments={departments} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
            <CardDescription>
              Distribution of projects across different statuses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectStatusChart projects={projects} projectStatuses={projectStatuses} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Milestone Responsibilities by Department</CardTitle>
            <CardDescription>
              Total milestones each department is responsible for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsibleDepartmentChart projects={projects} departments={departments} />
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold mt-6 mb-4">{selectedYear === 'all' ? 'All Projects' : `Projects for ${selectedYear}`}</h2>
        {projects.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project: any) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No projects found for the selected year.</p>
          </div>
        )}
      </div>
    </div>
  );
}
