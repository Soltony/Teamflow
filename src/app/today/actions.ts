
'use server';

import prisma from "@/lib/db";
import { startOfDay, endOfDay } from 'date-fns';

export async function getTodaysTasks(userId?: string) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Check if user has admin-level permissions (can see all projects)
    let hasAdminPermissions = false;
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: true },
        });
        
        hasAdminPermissions = user?.roles.some(role => 
            role.permissions.includes('projects:read') && 
            role.permissions.includes('projects:update') && 
            role.permissions.includes('projects:delete')
        ) ?? false;
    }

    // Build where clause based on permissions
    let projectWhereClause: any = {};
    
    if (!hasAdminPermissions && userId) {
        projectWhereClause = {
            OR: [
                { projectManagerId: userId },
                {
                    teams: {
                        some: {
                            members: {
                                some: { id: userId }
                            }
                        }
                    }
                },
                {
                    milestones: {
                        some: {
                            tasks: {
                                some: {
                                    assignees: {
                                        some: { id: userId }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };
    }

    const tasks = await prisma.task.findMany({
        where: {
            AND: [
                {
                    milestone: {
                        project: projectWhereClause
                    }
                },
                {
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
                        },
                        // Tasks that had an update today
                        {
                            updates: {
                                some: {
                                    createdAt: {
                                        gte: todayStart,
                                        lte: todayEnd
                                    }
                                }
                            }
                        }
                    ]
                }
            ]
        },
        include: {
            assignees: true,
            milestone: {
                include: {
                    project: {
                        include: {
                            status: true,
                            projectManager: true,
                            pmoDivision: true
                        }
                    },
                },
            },
            updates: {
                orderBy: {
                    createdAt: 'desc'
                },
            }
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
                description: project.description,
                status: project.status,
                projectManager: project.projectManager,
                pmoDivision: project.pmoDivision,
                startDate: project.startDate,
                endDate: project.endDate,
                tasks: [],
            });
        }
        projectsMap.get(project.id).tasks.push(task);
    });

    return JSON.parse(JSON.stringify(Array.from(projectsMap.values())));
}
