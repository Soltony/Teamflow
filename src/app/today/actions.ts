
'use server';

import prisma from "@/lib/db";
import { startOfDay, endOfDay } from 'date-fns';

export async function getTodaysTasks() {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const tasks = await prisma.task.findMany({
        where: {
            OR: [
                // Tasks that are currently active and not done
                {
                    AND: [
                        { startDate: { lte: todayEnd } },
                        { endDate: { gte: todayStart } },
                        { status: { not: 'DONE' } }
                    ]
                },
                // Tasks that were completed today
                {
                    completedAt: {
                        gte: todayStart,
                        lte: todayEnd
                    }
                }
            ]
        },
        include: {
            assignees: true,
            milestone: {
                include: {
                    project: true,
                },
            },
        },
        orderBy: {
            milestone: {
                project: {
                    name: 'asc'
                }
            }
        },
    });

    const projectsMap = new Map<string, any>();

    tasks.forEach(task => {
        const project = task.milestone.project;
        if (!projectsMap.has(project.id)) {
            projectsMap.set(project.id, {
                id: project.id,
                name: project.name,
                tasks: [],
            });
        }
        projectsMap.get(project.id).tasks.push(task);
    });

    return JSON.parse(JSON.stringify(Array.from(projectsMap.values())));
}
