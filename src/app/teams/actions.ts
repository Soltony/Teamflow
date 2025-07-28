
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Prisma } from '@prisma/client';

export async function createTeam(data: { name: string; projectId: string; teamLeadId: string; memberIds: string[] }) {
    try {
        await prisma.team.create({
            data: {
                name: data.name,
                projectId: data.projectId,
                teamLeadId: data.teamLeadId,
                members: {
                    connect: data.memberIds.map(id => ({ id }))
                }
            }
        });
        revalidatePath('/teams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to create team:", error);
        return { success: false, error: "Failed to create team." };
    }
}

export async function updateTeam(teamId: string, data: { name: string; projectId: string; teamLeadId: string; memberIds: string[] }) {
    try {
        await prisma.team.update({
            where: { id: teamId },
            data: {
                name: data.name,
                projectId: data.projectId,
                teamLeadId: data.teamLeadId,
                members: {
                    set: data.memberIds.map(id => ({ id }))
                }
            }
        });
        revalidatePath('/teams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to update team:", error);
        return { success: false, error: "Failed to update team." };
    }
}

export async function deleteTeam(teamId: string) {
    try {
        await prisma.team.delete({
            where: { id: teamId }
        });
        revalidatePath('/teams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete team:", error);
        return { success: false, error: "Failed to delete team." };
    }
}


export async function getTeamsPageData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
    });

    if (!user) {
        return { teams: [], projects: [], users: [] };
    }

    const isManagerOrAdmin = user.roles.some(role => role.name === 'Admin' || role.name === 'Project Manager' || role.name === 'CEO');
    
    let whereClause: Prisma.TeamWhereInput = {};

    if (!isManagerOrAdmin) {
        whereClause = {
            OR: [
                { teamLeadId: userId },
                { members: { some: { id: userId } } }
            ]
        };
    }

    const [teams, projects, users] = await Promise.all([
        prisma.team.findMany({
            where: whereClause,
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
                project: true,
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
    }));

    return {
        teams: JSON.parse(JSON.stringify(normalizedTeams)),
        projects: JSON.parse(JSON.stringify(projects)),
        users: JSON.parse(JSON.stringify(users)),
    };
}
