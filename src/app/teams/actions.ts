'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

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
        return { success: true };
    } catch (error) {
        console.error("Failed to delete team:", error);
        return { success: false, error: "Failed to delete team." };
    }
}
