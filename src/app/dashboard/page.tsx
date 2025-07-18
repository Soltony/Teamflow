
import React from 'react';
import prisma from "@/lib/db";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = 'force-dynamic';

const getCurrentWorkingYear = async () => {
    const setting = await prisma.setting.findUnique({
      where: { key: 'activeWorkingYear' },
    });
    // Fallback to a calculated year if setting is not present
    if (setting?.value) {
      return setting.value;
    }
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    return month >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

export default async function DashboardPage({ searchParams }: { searchParams: { year?: string } }) {
    const [allProjects, projectStatuses, pmoDivisions, departments, teams, distinctYears, activeYearSetting] = await Promise.all([
        prisma.project.findMany({
            include: {
                status: true,
                pmoDivision: true,
                responsibleDepartments: true,
                milestones: {
                    include: {
                        tasks: true,
                    },
                },
                blockers: true,
            },
        }),
        prisma.projectStatus.findMany(),
        prisma.pmoDivision.findMany(),
        prisma.department.findMany(),
        prisma.team.findMany({
            include: {
                teamLead: true,
                project: true,
            },
            orderBy: {
                name: 'asc'
            }
        }),
        prisma.project.findMany({
            select: { workingYear: true },
            distinct: ['workingYear'],
            orderBy: { workingYear: 'desc' },
        }),
        prisma.setting.findUnique({
            where: { key: 'activeWorkingYear' }
        })
    ]);
    
    const years = new Set(distinctYears.map(p => p.workingYear));
    const availableYears = ["all", ...Array.from(years).sort((a, b) => b.localeCompare(a))];
    const currentWorkingYear = activeYearSetting?.value || (await getCurrentWorkingYear());

    return (
        <DashboardClient
            initialProjects={JSON.parse(JSON.stringify(allProjects))}
            projectStatuses={JSON.parse(JSON.stringify(projectStatuses))}
            pmoDivisions={JSON.parse(JSON.stringify(pmoDivisions))}
            departments={JSON.parse(JSON.stringify(departments))}
            teams={JSON.parse(JSON.stringify(teams))}
            availableYears={availableYears}
            currentWorkingYear={currentWorkingYear}
        />
    )
}
