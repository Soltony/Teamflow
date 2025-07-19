
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
    // If month is June (5) or later, it's the start of a new financial year
    return month >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

function generateWorkingYears() {
    const currentYear = new Date().getFullYear();
    const years = new Set<string>();
    // Add past, current, and future years
    for (let i = -2; i <= 2; i++) {
        const year = currentYear + i;
        years.add(`${year}/${year + 1}`);
    }
    return Array.from(years);
}

export default async function DashboardPage({ searchParams }: { searchParams: { year?: string } }) {
    const activeYear = await getCurrentWorkingYear();

    const [allProjects, projectStatuses, pmoDivisions, departments, teams, distinctYears] = await Promise.all([
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
                blockers: {
                    where: {
                        status: 'OPEN'
                    }
                },
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
    ]);
    
    const existingYears = new Set(distinctYears.map(p => p.workingYear));
    const generatedYears = generateWorkingYears();
    const combinedYears = new Set([...generatedYears, ...existingYears]);
    
    const years = Array.from(combinedYears);
    const availableYears = ["all", ...years.sort((a, b) => b.localeCompare(a))];
    
    return (
        <DashboardClient
            initialProjects={JSON.parse(JSON.stringify(allProjects))}
            projectStatuses={JSON.parse(JSON.stringify(projectStatuses))}
            pmoDivisions={JSON.parse(JSON.stringify(pmoDivisions))}
            departments={JSON.parse(JSON.stringify(departments))}
            teams={JSON.parse(JSON.stringify(teams))}
            availableYears={availableYears}
            currentWorkingYear={activeYear}
        />
    )
}
