
import Link from "next/link";
import { PlusCircle, CheckCircle, Clock, AlertOctagon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import { projects, projectStatuses } from "@/lib/data";
import { DepartmentProjectsChart } from "@/components/dashboard/department-projects-chart";
import { ProjectStatusChart } from "@/components/dashboard/project-status-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isPast, parseISO, max as dateMax } from 'date-fns';

const StatCardWrapper = ({ children, count, href }: { children: React.ReactNode, count: number, href: string }) => {
  if (count > 0) {
    return <Link href={href}>{children}</Link>;
  }
  return <>{children}</>;
};


export default function DashboardPage() {
  const completedStatusId = projectStatuses.find(s => s.name === 'Completed')?.id;
  const completedProjects = projects.filter(p => p.statusId === completedStatusId);
  const overdueProjects = projects.filter(p => p.statusId !== completedStatusId && isPast(parseISO(p.endDate)));

  const onTimeProjectsCount = completedProjects.filter(project => {
    const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => parseISO(t.endDate)));
    if (allTaskEndDates.length === 0) return true;
    const lastTaskDate = dateMax(allTaskEndDates);
    return lastTaskDate <= parseISO(project.endDate);
  }).length;
  
  const lateProjectsCount = completedProjects.length - onTimeProjectsCount;

  const totalBlockersCount = projects.reduce((acc, p) => acc + (p.blockers?.filter(b => b.status === 'open').length || 0), 0);
  
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
        <StatCardWrapper count={onTimeProjectsCount} href="/reports?type=on-time">
          <Card className={onTimeProjectsCount > 0 ? 'hover:bg-muted transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Completion</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onTimeProjectsCount}</div>
              <p className="text-xs text-muted-foreground">projects completed on schedule</p>
            </CardContent>
          </Card>
        </StatCardWrapper>
        
        <StatCardWrapper count={lateProjectsCount} href="/reports?type=late">
          <Card className={lateProjectsCount > 0 ? 'hover:bg-muted transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late Completion</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lateProjectsCount}</div>
              <p className="text-xs text-muted-foreground">projects completed after schedule</p>
            </CardContent>
          </Card>
        </StatCardWrapper>

        <StatCardWrapper count={overdueProjects.length} href="/reports?type=overdue">
          <Card className={overdueProjects.length > 0 ? 'hover:bg-muted transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Projects</CardTitle>
              <AlertOctagon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overdueProjects.length}</div>
              <p className="text-xs text-muted-foreground">active projects past their deadline</p>
            </CardContent>
          </Card>
        </StatCardWrapper>

        <StatCardWrapper count={totalBlockersCount} href="/reports?type=active-blockers">
          <Card className={totalBlockersCount > 0 ? 'hover:bg-muted transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Blockers</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBlockersCount}</div>
              <p className="text-xs text-muted-foreground">issues requiring attention</p>
            </CardContent>
          </Card>
        </StatCardWrapper>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects by Owning Department</CardTitle>
            <CardDescription>
              Distribution of projects across owning departments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentProjectsChart />
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
            <ProjectStatusChart />
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
