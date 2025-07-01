import prisma from "@/lib/db";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { isPast, max as dateMax } from 'date-fns';

export default async function DashboardPage({ searchParams }: { searchParams?: { year?: string } }) {
    const allProjects = await prisma.project.findMany({
        include: {
            milestones: {
                include: {
                    tasks: true,
                    responsibleDepartments: true,
                },
            },
            blockers: true,
        },
    });
    
    const projectStatuses = await prisma.projectStatus.findMany();
    const departments = await prisma.department.findMany();

    const selectedYear = searchParams?.year || "all";
    
    const years = new Set(allProjects.map(p => p.workingYear));
    const availableYears = ["all", ...Array.from(years).sort((a, b) => b.localeCompare(a))];

    const projects = selectedYear === "all" 
        ? allProjects 
        : allProjects.filter(p => p.workingYear === selectedYear);
    
    const completedStatusId = projectStatuses.find(s => s.name === 'Completed')?.id;
    const completedProjects = projects.filter(p => p.statusId === completedStatusId);
    const overdueProjects = projects.filter(p => p.statusId !== completedStatusId && isPast(p.endDate));

    const onTimeProjectsCount = completedProjects.filter(project => {
        const allTaskEndDates = project.milestones.flatMap(m => m.tasks.map(t => t.endDate));
        if (allTaskEndDates.length === 0) return true;
        const lastTaskDate = dateMax(allTaskEndDates);
        return lastTaskDate <= project.endDate;
    }).length;
    
    const lateProjectsCount = completedProjects.length - onTimeProjectsCount;
    const totalBlockersCount = projects.reduce((acc, p) => acc + (p.blockers?.filter(b => b.status === 'OPEN').length || 0), 0);
    
    const stats = {
        onTimeProjectsCount,
        lateProjectsCount,
        overdueProjectsCount: overdueProjects.length,
        totalBlockersCount
    };

    return (
        <DashboardClient
            projects={JSON.parse(JSON.stringify(projects))}
            projectStatuses={JSON.parse(JSON.stringify(projectStatuses))}
            departments={JSON.parse(JSON.stringify(departments))}
            availableYears={availableYears}
            selectedYear={selectedYear}
            stats={stats}
        />
    )
}
