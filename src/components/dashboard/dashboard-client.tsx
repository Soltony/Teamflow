
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle, Clock, AlertOctagon, ShieldAlert, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { isPast, max as dateMax, parseISO, format } from 'date-fns';
import { useAuth } from "@/context/auth-context";

const StatCardWrapper = ({ children, count, href }: { children: React.ReactNode, count: number, href: string }) => {
  if (count > 0) {
    return <Link href={href}>{children}</Link>;
  }
  return <>{children}</>;
};

export function DashboardClient({ initialProjects, projectStatuses, pmoDivisions, departments, teams, availableYears, currentWorkingYear }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  
  if (!initialProjects || !projectStatuses || !pmoDivisions || !departments || !teams) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Loading Dashboard...</h1>
      </div>
    );
  }

  const selectedYear = searchParams.get('year') || currentWorkingYear;
  const selectedDivision = searchParams.get('division') || "all";

  const { filteredProjects, filteredTeams, activeProjects } = React.useMemo(() => {
    let tempProjects = initialProjects;

    if (selectedYear !== "all") {
        tempProjects = tempProjects.filter((p: any) => p.workingYear === selectedYear);
    }
    
    if (selectedDivision !== "all") {
        tempProjects = tempProjects.filter((p: any) => p.pmoDivisionId === selectedDivision);
    }
    
    const projectIds = new Set(tempProjects.map((p:any) => p.id));
    const tempTeams = teams.filter((t: any) => projectIds.has(t.projectId));

    const completedStatusId = projectStatuses.find((s: any) => s.name === 'Completed')?.id;
    const activeProjs = tempProjects.filter((p: any) => p.statusId !== completedStatusId);

    return { 
      filteredProjects: tempProjects, 
      filteredTeams: tempTeams,
      activeProjects: activeProjs 
    };
  }, [selectedYear, selectedDivision, initialProjects, teams, projectStatuses]);

  const stats = React.useMemo(() => {
    const completedStatusId = projectStatuses.find((s: any) => s.name === 'Completed')?.id;
    const completedProjects = filteredProjects.filter((p: any) => p.statusId === completedStatusId);
    const overdueProjects = filteredProjects.filter((p: any) => p.statusId !== completedStatusId && isPast(parseISO(p.endDate)));

    const onTimeProjectsCount = completedProjects.filter((project: any) => {
        const allTaskEndDates = project.milestones.flatMap((m: any) => m.tasks.map((t: any) => parseISO(t.endDate)));
        if (allTaskEndDates.length === 0) return true;
        const lastTaskDate = dateMax(allTaskEndDates);
        return lastTaskDate <= parseISO(project.endDate);
    }).length;
    
    const lateProjectsCount = completedProjects.length - onTimeProjectsCount;
    const totalBlockersCount = filteredProjects.reduce((acc: number, p: any) => acc + (p.blockers?.filter((b: any) => b.status === 'OPEN').length || 0), 0);
    
    return {
        onTimeProjectsCount,
        lateProjectsCount,
        overdueProjectsCount: overdueProjects.length,
        totalBlockersCount
    };
  }, [filteredProjects, projectStatuses]);

  const handleQueryChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== "all" && value !== currentWorkingYear) {
      params.set(key, value);
    } else {
      params.delete(key);
      if (value === "all") {
        params.set(key, "all");
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Projects Dashboard</h1>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={selectedYear} onValueChange={(value) => handleQueryChange('year', value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
            <Select value={selectedDivision} onValueChange={(value) => handleQueryChange('division', value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select a PMO division" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PMO Divisions</SelectItem>
                {pmoDivisions.map((div: any) => (
                    <SelectItem key={div.id} value={div.id}>
                        {div.name}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Welcome to NIB PMO!</CardTitle>
            <CardDescription>
              Your central hub for managing projects, teams, and PMO divisions
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
            <CardTitle>Projects by Owning PMO Division</CardTitle>
            <CardDescription>
              Distribution of projects across owning PMO divisions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentProjectsChart projects={filteredProjects} pmoDivisions={pmoDivisions} />
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
            <ProjectStatusChart projects={filteredProjects} projectStatuses={projectStatuses} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projects by Responsible Department</CardTitle>
            <CardDescription>
              Total projects each department is responsible for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsibleDepartmentChart 
              projects={filteredProjects} 
              departments={departments}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Projects Summary</CardTitle>
          <CardDescription>A list of all projects that are currently active.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-center">Milestones</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeProjects.length > 0 ? (
                activeProjects.map((project: any) => {
                  const completedMilestones = project.milestones.filter(
                    (m: any) => m.tasks.length > 0 && m.tasks.every((t: any) => t.status === 'DONE')
                  ).length;
                  const totalMilestones = project.milestones.length;

                  return (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{project.status.name}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(project.startDate), 'MMM dd')} - {format(parseISO(project.endDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-center">
                        {completedMilestones} / {totalMilestones}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/projects/${project.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No active projects found for the current selection.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization PMO Divisions</CardTitle>
            <CardDescription>
              A list of all PMO divisions.
              {hasPermission('pmo-divisions:view') && (
                <>
                  {' '}Manage them in the{' '}
                  <Link href="/pmo-divisions" className="text-primary hover:underline">
                    PMO Divisions page
                  </Link>
                  .
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pmoDivisions.length > 0 ? (
                pmoDivisions.map((div: any, index: number) => (
                  <React.Fragment key={div.id}>
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                      <div>
                        <p className="font-semibold">{div.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {div.responsibleName}, {div.responsibleTitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{div.responsiblePhone}</span>
                      </div>
                    </div>
                    {index < pmoDivisions.length - 1 && <Separator />}
                  </React.Fragment>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No PMO divisions found. Add one on the PMO Divisions page.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
            <CardHeader>
            <CardTitle>Project Teams</CardTitle>
            <CardDescription>
              A list of all teams.
              {hasPermission('teams:read') && (
                <>
                  {' '}Manage them in the{' '}
                  <Link href="/teams" className="text-primary hover:underline">
                    Teams page
                  </Link>
                  .
                </>
              )}
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-2">
                {filteredTeams.length > 0 ? (
                filteredTeams.map((team: any, index: number) => (
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
                    {index < filteredTeams.length - 1 && <Separator />}
                    </React.Fragment>
                ))
                ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                    No teams found for the current selection.
                </p>
                )}
            </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
