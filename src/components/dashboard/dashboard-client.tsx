
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PlusCircle, CheckCircle, Clock, AlertOctagon, ShieldAlert, Phone } from "lucide-react";
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
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { isPast, max as dateMax, parseISO } from 'date-fns';
import { useAuth } from "@/context/auth-context";

const StatCardWrapper = ({ children, count, href }: { children: React.ReactNode, count: number, href: string }) => {
  if (count > 0) {
    return <Link href={href}>{children}</Link>;
  }
  return <>{children}</>;
};

export function DashboardClient({ initialProjects, projectStatuses, departments, teams, availableYears }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  
  // Add a guard to ensure all required data is present before rendering.
  // This prevents crashes on hot-reloads or if data fetching fails.
  if (!initialProjects || !projectStatuses || !departments || !teams) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Loading Dashboard...</h1>
      </div>
    );
  }

  const selectedYear = searchParams.get('year') || "all";

  const projects = React.useMemo(() => {
      return selectedYear === "all"
        ? initialProjects
        : initialProjects.filter((p: any) => p.workingYear === selectedYear);
  }, [selectedYear, initialProjects]);

  const stats = React.useMemo(() => {
    const completedStatusId = projectStatuses.find((s: any) => s.name === 'Completed')?.id;
    const completedProjects = projects.filter((p: any) => p.statusId === completedStatusId);
    const overdueProjects = projects.filter((p: any) => p.statusId !== completedStatusId && isPast(parseISO(p.endDate)));

    const onTimeProjectsCount = completedProjects.filter((project: any) => {
        const allTaskEndDates = project.milestones.flatMap((m: any) => m.tasks.map((t: any) => parseISO(t.endDate)));
        if (allTaskEndDates.length === 0) return true;
        const lastTaskDate = dateMax(allTaskEndDates);
        return lastTaskDate <= parseISO(project.endDate);
    }).length;
    
    const lateProjectsCount = completedProjects.length - onTimeProjectsCount;
    const totalBlockersCount = projects.reduce((acc: number, p: any) => acc + (p.blockers?.filter((b: any) => b.status === 'OPEN').length || 0), 0);
    
    return {
        onTimeProjectsCount,
        lateProjectsCount,
        overdueProjectsCount: overdueProjects.length,
        totalBlockersCount
    };
  }, [projects, projectStatuses]);


  const handleYearChange = (year: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (year !== "all") {
      params.set("year", year);
    } else {
      params.delete("year");
    }
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
        {hasPermission('projects:create') && (
          <Button asChild>
            <Link href="/projects/new">
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Project
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Welcome to NIB Team!</CardTitle>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization Departments</CardTitle>
            <CardDescription>
              A list of all departments. Manage them in the{' '}
              <Link href="/departments" className="text-primary hover:underline">
                Departments page
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {departments.length > 0 ? (
                departments.map((dept: any, index: number) => (
                  <React.Fragment key={dept.id}>
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                      <div>
                        <p className="font-semibold">{dept.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {dept.responsibleName}, {dept.responsibleTitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{dept.responsiblePhone}</span>
                      </div>
                    </div>
                    {index < departments.length - 1 && <Separator />}
                  </React.Fragment>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No departments found. Add one on the Departments page.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
            <CardHeader>
            <CardTitle>Project Teams</CardTitle>
            <CardDescription>
                A list of all teams. Manage them in the{' '}
                <Link href="/teams" className="text-primary hover:underline">
                Teams page
                </Link>
                .
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-2">
                {teams.length > 0 ? (
                teams.map((team: any, index: number) => (
                    <React.Fragment key={team.id}>
                    <div className="flex items-start justify-between p-2 rounded-md hover:bg-muted/50">
                        <div>
                        <p className="font-semibold">{team.name}</p>
                        <p className="text-sm text-muted-foreground">
                            Lead: {team.teamLead.name}
                        </p>
                        </div>
                        <Badge variant="secondary">{team.project.name}</Badge>
                    </div>
                    {index < teams.length - 1 && <Separator />}
                    </React.Fragment>
                ))
                ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                    No teams found. Add one on the Teams page.
                </p>
                )}
            </div>
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
