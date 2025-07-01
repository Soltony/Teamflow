
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function approveTaskAction(taskId: string, teamLeadId: string, teamLeadName: string) {
    try {
        const updateText = `Task approved by ${teamLeadName}. Status changed to Done.`;
        
        await prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'DONE',
                completedAt: new Date(),
                updates: {
                    create: {
                        text: updateText,
                        authorId: teamLeadId,
                        type: 'STATUS_CHANGE',
                    }
                }
            }
        });

        revalidatePath('/team-view');
        return { success: true };

    } catch (error) {
        console.error("Failed to approve task:", error);
        return { success: false, error: "Failed to approve task." };
    }
}


export async function declineTaskAction(taskId: string, teamLeadId: string, teamLeadName: string) {
    try {
        const updateText = `Task declined by ${teamLeadName}. Status changed back to In Progress.`;
        
        await prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'IN_PROGRESS',
                updates: {
                    create: {
                        text: updateText,
                        authorId: teamLeadId,
                        type: 'STATUS_CHANGE',
                    }
                }
            }
        });

        revalidatePath('/team-view');
        return { success: true };

    } catch (error) {
        console.error("Failed to decline task:", error);
        return { success: false, error: "Failed to decline task." };
    }
}
