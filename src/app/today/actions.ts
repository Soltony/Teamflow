
'use server';

import prisma from "@/lib/db";
import { startOfDay, endOfDay, addDays } from 'date-fns';

export async function getTodaysTasks(userId?: string, targetDate: Date = new Date()) {
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

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
                        // Tasks that are due today
                        {
                            endDate: {
                                gte: dayStart,
                                lte: dayEnd
                            }
                        },
                        // Tasks that were completed today
                        {
                            completedAt: {
                                gte: dayStart,
                                lte: dayEnd
                            }
                        },
                        // Tasks that had an update today
                        {
                            updates: {
                                some: {
                                    createdAt: {
                                        gte: dayStart,
                                        lte: dayEnd
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
                            pmoDivision: true,
                            milestones: { // Fetch all milestones for the project
                                include: {
                                    tasks: true, // And all tasks for each milestone
                                }
                            }
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
                milestones: project.milestones,
                tasks: [],
            });
        }
        projectsMap.get(project.id).tasks.push(task);
    });
    
    const allUsers = await prisma.user.findMany();
    
    const activityStats = {
        projectsActive: projectsMap.size,
        tasksUpdated: tasks.filter(t => t.updates.some(u => u.createdAt >= dayStart && u.createdAt <= dayEnd)).length,
        tasksCompleted: tasks.filter(t => t.completedAt && t.completedAt >= dayStart && t.completedAt <= dayEnd).length,
    };

    return {
        projects: JSON.parse(JSON.stringify(Array.from(projectsMap.values()))),
        users: JSON.parse(JSON.stringify(allUsers)),
        stats: activityStats,
    };
}
