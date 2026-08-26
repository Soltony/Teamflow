
import React from 'react';
import prisma from "@/lib/db";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { requirePermissionOrRedirect } from "@/lib/auth/guard";
import { serialize } from '@/lib/serialize';
import { OPEN_BLOCKER_STATUSES } from '@/lib/validation/blocker';
import { USER_DISPLAY_SELECT } from '@/lib/queries/user-select';

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

type DashboardSearchParams = { year?: string; division?: string };

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<DashboardSearchParams>;
}) {
    await requirePermissionOrRedirect('dashboard:view');

    const activeYear = await getCurrentWorkingYear();
    const params = await searchParams;

    // The year and division filters run in the query rather than over an array
    // the browser already holds. The page previously loaded every project in
    // the bank — with its milestones, tasks and blockers — and then discarded
    // most of them client-side to show one year of one division.
    const selectedYear = params?.year ?? activeYear;
    const selectedDivision = params?.division;

    const projectWhere = {
        ...(selectedYear && selectedYear !== 'all' ? { workingYear: selectedYear } : {}),
        ...(selectedDivision && selectedDivision !== 'all'
            ? { pmoDivisionId: selectedDivision }
            : {}),
    };

    const [allProjects, projectStatuses, pmoDivisions, departments, teams, distinctYears] = await Promise.all([
        prisma.project.findMany({
            where: projectWhere,
            include: {
                status: true,
                pmoDivision: true,
                projectManager: true,
                responsibleDepartments: true,
                milestones: {
                    include: {
                        tasks: true,
                    },
                },
                blockers: {
                    where: {
                        status: { in: [...OPEN_BLOCKER_STATUSES] }
                    }
                },
            },
        }),
        prisma.projectStatus.findMany(),
        prisma.pmoDivision.findMany(),
        prisma.department.findMany(),
        prisma.team.findMany({
            // A team is reached through its project links now.
            where: { projects: { some: { project: projectWhere } } },
            include: {
                teamLead: { select: USER_DISPLAY_SELECT },
                projects: { include: { project: { select: { id: true, name: true } } } },
                members: { select: USER_DISPLAY_SELECT },
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
            initialProjects={serialize(allProjects)}
            projectStatuses={serialize(projectStatuses)}
            pmoDivisions={serialize(pmoDivisions)}
            departments={serialize(departments)}
            teams={serialize(teams)}
            availableYears={availableYears}
            currentWorkingYear={activeYear}
        />
    )
}
