
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle, Clock, AlertOctagon, ShieldAlert, Phone, Target, Award, CircleDot, User, Building } from "lucide-react";
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
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
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
import { CelebrationSlider } from "./celebration-slider";

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

  const { filteredProjects, filteredTeams, activeProjects, completedProjects } = React.useMemo(() => {
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
    const completedProjs = tempProjects.filter((p: any) => p.statusId === completedStatusId);

    return { 
      filteredProjects: tempProjects, 
      filteredTeams: tempTeams,
      activeProjects: activeProjs,
      completedProjects: completedProjs
    };
  }, [selectedYear, selectedDivision, initialProjects, projectStatuses, teams]);

  const { stats, projectsWithBlockers } = React.useMemo(() => {
    const completedStatusId = projectStatuses.find((s: any) => s.name === 'Completed')?.id;
    const completedProjects = filteredProjects.filter((p: any) => p.statusId === completedStatusId);
    const overdueProjects = filteredProjects.filter((p: any) => p.statusId !== completedStatusId && isPast(parseISO(p.endDate)));
    const projectsWithOpenBlockers = filteredProjects.filter((p: any) => p.blockers?.some((b: any) => b.status === 'OPEN'));
    
    const onTimeProjectsCount = completedProjects.filter((project: any) => {
        const allTaskEndDates = project.milestones.flatMap((m: any) => m.tasks.map((t: any) => parseISO(t.endDate)));
        if (allTaskEndDates.length === 0) return true;
        const lastTaskDate = dateMax(allTaskEndDates);
        return lastTaskDate <= parseISO(project.endDate);
    }).length;
    
    const lateProjectsCount = completedProjects.length - onTimeProjectsCount;

    const totalBlockersCount = projectsWithOpenBlockers.reduce((acc: number, p: any) => {
        const openBlockers = p.blockers?.filter((b: any) => b.status === 'OPEN') || [];
        return acc + openBlockers.length;
    }, 0);
    
    return {
        stats: {
          onTimeProjectsCount,
          lateProjectsCount,
          overdueProjectsCount: overdueProjects.length,
          totalBlockersCount
        },
        projectsWithBlockers: projectsWithOpenBlockers,
    };
  }, [filteredProjects, projectStatuses]);

  const activeBlockersHref = React.useMemo(() => {
    if (projectsWithBlockers.length === 1) {
        return `/projects/${projectsWithBlockers[0].id}?tab=blockers`;
    }
    return `/reports?type=active-blockers&year=${selectedYear}`;
  }, [projectsWithBlockers, selectedYear]);

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
  
  const calculateProjectProgress = (project: any) => {
    return project.milestones.reduce((progress: number, milestone: any) => {
        const completedTaskWeightInMilestone = milestone.tasks
            .filter((task: any) => task.status === 'DONE')
            .reduce((sum: number, task: any) => sum + task.weight, 0);
        const milestoneProgress = completedTaskWeightInMilestone / 100;
        return progress + (milestoneProgress * milestone.weight);
    }, 0);
  };
  
  const calculateMilestoneProgress = (milestone: any) => {
    if (!milestone.tasks || milestone.tasks.length === 0) return 0;
    const totalProgress = milestone.tasks.reduce((acc: number, task: any) => {
      return acc + (task.progress * (task.weight / 100));
    }, 0);
    return totalProgress;
  };

  const epmoLeader = pmoDivisions.find((d: any) => d.name === 'EPMO');
  const otherDivisions = pmoDivisions.filter((d: any) => d.name !== 'EPMO');


  return (
    <div className="p-4 sm:p-6 space-y-6">
       {completedProjects.length > 0 && (
        <CelebrationSlider completedProjects={completedProjects} teams={teams} />
      )}
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
                <SelectValue placeholder="Select an EPMO division" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All EPMO Divisions</SelectItem>
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
            <CardTitle>Welcome to NIB EPMO</CardTitle>
            <CardDescription className="whitespace-pre-line">
              This is your centralized platform for managing all EPMO projects.
Track progress, manage resources, and stay aligned with strategic goals.
Built for collaboration, visibility, and streamlined delivery.
Let’s keep projects on track—together.
            </CardDescription>
          </CardHeader>
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

        <StatCardWrapper count={stats.totalBlockersCount} href={activeBlockersHref}>
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

      <Card>
        <CardHeader>
          <CardTitle>Active Projects Summary</CardTitle>
          <CardDescription>A list of all projects that are currently active. Expand each project to see its milestones and tasks.</CardDescription>
        </CardHeader>
        <CardContent>
            {activeProjects.length > 0 ? (
                <Accordion type="multiple" className="w-full space-y-2">
                    {activeProjects.map((project: any) => {
                        const projectProgress = calculateProjectProgress(project);
                        return (
                            <AccordionItem value={project.id} key={project.id} className="border rounded-md px-4">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                                        <div className="flex-1 text-left">
                                            <p className="font-semibold text-base">{project.name}</p>
                                            <p className="text-sm text-muted-foreground">{project.status.name}</p>
                                        </div>
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <Progress value={projectProgress} className="w-full md:w-48 h-2.5" />
                                            <span className="text-sm font-semibold">{Math.round(projectProgress)}%</span>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <Accordion type="multiple" className="w-full space-y-2">
                                        {project.milestones.map((milestone: any) => {
                                            const milestoneProgress = calculateMilestoneProgress(milestone);
                                            return (
                                                <AccordionItem value={milestone.id} key={milestone.id} className="border rounded-md px-4 bg-muted/50">
                                                    <AccordionTrigger className="hover:no-underline text-sm py-3">
                                                         <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                                                            <div className="flex-1 text-left">
                                                                <p className="font-medium">{milestone.title}</p>
                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                    <span>Due: {format(parseISO(milestone.dueDate), 'MMM dd, yyyy')}</span>
                                                                    <span>&bull;</span>
                                                                    <span>Weight: {milestone.weight}%</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4 w-full md:w-auto">
                                                                <Progress value={milestoneProgress} className="w-full md:w-32 h-2" />
                                                                <span className="text-xs font-semibold">{Math.round(milestoneProgress)}%</span>
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-2 pb-4">
                                                        {milestone.tasks.length > 0 ? (
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Task</TableHead>
                                                                        <TableHead>Status</TableHead>
                                                                        <TableHead>Progress</TableHead>
                                                                        <TableHead>Due Date</TableHead>
                                                                        <TableHead className="text-right">Weight</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {milestone.tasks.map((task: any) => (
                                                                        <TableRow key={task.id}>
                                                                            <TableCell>{task.title}</TableCell>
                                                                            <TableCell><Badge variant="outline">{task.status.replace(/_/g, ' ')}</Badge></TableCell>
                                                                            <TableCell>
                                                                                <div className="flex items-center gap-2">
                                                                                    <Progress value={task.progress} className="h-2 w-20" />
                                                                                    <span>{task.progress}%</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell>{format(parseISO(task.endDate), 'MMM dd')}</TableCell>
                                                                            <TableCell className="text-right">{task.weight}%</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        ) : (
                                                            <p className="text-center text-sm text-muted-foreground py-4">No tasks in this milestone.</p>
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            )
                                        })}
                                    </Accordion>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            ) : (
                <div className="h-24 flex items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-md">
                    No active projects found for the current selection.
                </div>
            )}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Projects by Owning EPMO Division</CardTitle>
            <CardDescription>
              Distribution of projects across owning EPMO divisions.
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>EPMO Leader</CardTitle>
                <CardDescription>
                The primary contact for the Enterprise Project Management Office.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {epmoLeader ? (
                    <div className="flex items-center gap-4">
                        <User className="h-12 w-12 text-muted-foreground" />
                        <div className="space-y-1">
                            <p className="font-bold text-lg">{epmoLeader.responsibleName}</p>
                            <p className="font-semibold text-muted-foreground">{epmoLeader.responsibleTitle}</p>
                            <a href={`tel:${epmoLeader.responsiblePhone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                                <Phone className="h-4 w-4" />
                                <span>{epmoLeader.responsiblePhone}</span>
                            </a>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No EPMO Leader with the division name "EPMO" found. Add one on the EPMO Divisions page.
                    </p>
                )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
            <CardTitle>Other EPMO Divisions</CardTitle>
            <CardDescription>
              A list of other EPMO divisions.
              {hasPermission('pmo-divisions:view') && (
                <>
                  {' '}Manage them in the{' '}
                  <Link href="/pmo-divisions" className="text-primary hover:underline">
                    EPMO Divisions page
                  </Link>
                  .
                </>
              )}
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-2">
                {otherDivisions.length > 0 ? (
                otherDivisions.map((division: any, index: number) => (
                    <React.Fragment key={division.id}>
                    <div className="flex items-start justify-between p-2 rounded-md hover:bg-muted/50">
                        <div>
                        <p className="font-semibold">{division.name}</p>
                        <p className="text-sm text-muted-foreground">
                            {division.responsibleName}, {division.responsibleTitle}
                        </p>
                        </div>
                        <a href={`tel:${division.responsiblePhone}`} className="text-sm text-muted-foreground hover:text-primary">
                            <Phone className="h-4 w-4" />
                        </a>
                    </div>
                    {index < otherDivisions.length - 1 && <Separator />}
                    </React.Fragment>
                ))
                ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                    No other EPMO divisions found.
                </p>
                )}
            </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
