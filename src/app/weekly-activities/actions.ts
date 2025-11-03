
'use server';

import prisma from "@/lib/db";
import { startOfWeek, endOfWeek } from 'date-fns';

export async function getWeeklyTasks(userId?: string, targetDate: Date = new Date()) {
    const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 }); // Sunday
    
    const nextWeekStart = startOfWeek(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });


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
                        // Tasks that are due this week
                        {
                            endDate: {
                                gte: weekStart,
                                lte: weekEnd
                            }
                        },
                        // Tasks that were completed this week
                        {
                            completedAt: {
                                gte: weekStart,
                                lte: weekEnd
                            }
                        },
                        // Tasks that had an update this week
                        {
                            updates: {
                                some: {
                                    createdAt: {
                                        gte: weekStart,
                                        lte: weekEnd
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
                include: {
                    author: true,
                },
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

    const nextWeekDueTasks = await prisma.task.count({
        where: {
            milestone: { project: projectWhereClause },
            endDate: {
                gte: nextWeekStart,
                lte: nextWeekEnd,
            },
            status: {
                not: 'DONE'
            }
        }
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
    
    const allUsers = await prisma.user.findMany();

    const activityStats = {
        projectsActive: projectsMap.size,
        tasksUpdated: tasks.filter(t => t.updates.some(u => u.createdAt >= weekStart && u.createdAt <= weekEnd)).length,
        tasksCompleted: tasks.filter(t => t.completedAt && t.completedAt >= weekStart && t.completedAt <= weekEnd).length,
        tasksDueNextWeek: nextWeekDueTasks,
    };

    return {
        projects: JSON.parse(JSON.stringify(Array.from(projectsMap.values()))),
        users: JSON.parse(JSON.stringify(allUsers)),
        stats: activityStats
    };
}
