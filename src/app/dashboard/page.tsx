
import React from 'react';
import prisma from "@/lib/db";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = 'force-dynamic';

const getCurrentWorkingYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed (January is 0)
    // Assuming fiscal year starts in July (month index 6)
    if (month >= 6) {
      return `${year}/${year + 1}`;
    } else {
      return `${year - 1}/${year}`;
    }
};

export default async function DashboardPage({ searchParams }: { searchParams: { year?: string } }) {
    const [allProjects, projectStatuses, departments, teams] = await Promise.all([
        prisma.project.findMany({
            include: {
                status: true,
                milestones: {
                    include: {
                        tasks: true,
                        responsibleDepartments: true,
                    },
                },
                blockers: true,
            },
        }),
        prisma.projectStatus.findMany(),
        prisma.department.findMany(),
        prisma.team.findMany({
            include: {
                teamLead: true,
                project: true,
            },
            orderBy: {
                name: 'asc'
            }
        })
    ]);
    
    const years = new Set(allProjects.map(p => p.workingYear));
    const availableYears = ["all", ...Array.from(years).sort((a, b) => b.localeCompare(a))];
    const currentWorkingYear = getCurrentWorkingYear();

    return (
        <DashboardClient
            initialProjects={JSON.parse(JSON.stringify(allProjects))}
            projectStatuses={JSON.parse(JSON.stringify(projectStatuses))}
            departments={JSON.parse(JSON.stringify(departments))}
            teams={JSON.parse(JSON.stringify(teams))}
            availableYears={availableYears}
            currentWorkingYear={currentWorkingYear}
        />
    )
}
