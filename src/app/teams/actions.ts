
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Prisma } from '@prisma/client';
import { requirePermission, canSeeAllProjects } from "@/lib/auth/guard";
import { resolvePage, type PageRequest } from "@/lib/pagination";
import { serialize } from '@/lib/serialize';

/**
 * A team can now serve several projects, so the caller passes a list.
 *
 * Creating one with no projects is allowed and useful: a standing team can
 * exist before it is put on anything.
 */
export async function createTeam(data: {
    name: string;
    description?: string;
    projectIds: string[];
    teamLeadId: string;
    memberIds: string[];
}) {
    await requirePermission('teams:create');
    try {
        await prisma.team.create({
            data: {
                name: data.name,
                description: data.description || null,
                teamLeadId: data.teamLeadId,
                members: {
                    connect: data.memberIds.map(id => ({ id }))
                },
                projects: {
                    create: data.projectIds.map(projectId => ({ projectId })),
                },
            }
        });
        revalidatePath('/projects');
        revalidatePath('/teams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to create team:", error);
        return { success: false, error: "Failed to create team." };
    }
}

export async function updateTeam(teamId: string, data: {
    name: string;
    description?: string;
    projectIds: string[];
    teamLeadId: string;
    memberIds: string[];
}) {
    await requirePermission('teams:update');
    try {
        await prisma.$transaction(async (tx) => {
            await tx.team.update({
                where: { id: teamId },
                data: {
                    name: data.name,
                    description: data.description || null,
                    teamLeadId: data.teamLeadId,
                    members: {
                        set: data.memberIds.map(id => ({ id }))
                    },
                }
            });

            // Replace the project links rather than clearing and rebuilding
            // them all, so the createdAt on an unchanged link survives.
            const existing = await tx.projectTeam.findMany({
                where: { teamId },
                select: { projectId: true },
            });
            const before = new Set(existing.map(e => e.projectId));
            const after = new Set(data.projectIds);

            const removed = [...before].filter(id => !after.has(id));
            const added = [...after].filter(id => !before.has(id));

            if (removed.length) {
                await tx.projectTeam.deleteMany({
                    where: { teamId, projectId: { in: removed } },
                });
            }
            if (added.length) {
                await tx.projectTeam.createMany({
                    data: added.map(projectId => ({ teamId, projectId })),
                    skipDuplicates: true,
                });
            }
        });
        revalidatePath('/projects');
        revalidatePath('/teams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to update team:", error);
        return { success: false, error: "Failed to update team." };
    }
}

export async function deleteTeam(teamId: string) {
    await requirePermission('teams:delete');
    try {
        await prisma.team.delete({
            where: { id: teamId }
        });
        revalidatePath('/projects');
        revalidatePath('/teams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete team:", error);
        return { success: false, error: "Failed to delete team." };
    }
}


/** Identity comes from the session; `_userId` is ignored (see archive/actions.ts). */
export async function getTeamsPageData(_userId?: string, pageRequest: PageRequest = {}) {
    const user = await requirePermission('teams:read');
    const userId = user.id;

    if (!user) {
        return { teams: [], projects: [], users: [] };
    }

    // Whoever sees the whole portfolio sees every team in it. Inferring this
    // from teams:read + update + delete meant granting delete rights silently
    // granted visibility of every team in the bank.
    const hasAdminPermissions = canSeeAllProjects(user);
    
    let whereClause: Prisma.TeamWhereInput = {};

    if (!hasAdminPermissions) {
        whereClause = {
            OR: [
                { teamLeadId: userId },
                { members: { some: { id: userId } } }
            ]
        };
    }

    const totalCount = await prisma.team.count({ where: whereClause });
    const { page, pageSize, skip, totalPages } = resolvePage(pageRequest, totalCount);

    const [teams, projects, users] = await Promise.all([
        prisma.team.findMany({
            where: whereClause,
            skip,
            take: pageSize,
            include: {
                members: {
                    include: {
                        roles: {
                            select: { name: true }
                        }
                    }
                },
                teamLead: {
                     include: {
                        roles: {
                            select: { name: true }
                        }
                    }
                },
                projects: {
                    include: { project: { select: { id: true, name: true } } },
                },
            },
            orderBy: {
                name: 'asc'
            }
        }),
        prisma.project.findMany({
            orderBy: {
                name: 'asc'
            }
        }),
        prisma.user.findMany({
            include: {
                roles: {
                    select: { name: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        }),
    ]);
    
    const normalizedTeams = teams.map(team => ({
        ...team,
        memberIds: team.members.map(member => member.id),
        // Flattened for the UI, which cares about the projects rather than
        // the join rows that connect them.
        projectIds: team.projects.map(link => link.projectId),
        projectNames: team.projects.map(link => link.project.name),
    }));

    return {
        teams: serialize(normalizedTeams),
        projects: serialize(projects),
        users: serialize(users),
        page,
        pageSize,
        totalCount,
        totalPages,
    };
}
