
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getPendingTimelineChanges() {
    const requests = await prisma.timelineChangeRequest.findMany({
        where: {
            status: 'PENDING',
        },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                }
            },
            requestedBy: {
                select: {
                    id: true,
                    name: true
                }
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    });

    return JSON.parse(JSON.stringify(requests));
}

export async function approveTimelineChange(requestId: string, reviewerId: string) {
    try {
        const request = await prisma.timelineChangeRequest.findUnique({ where: { id: requestId } });
        if (!request) {
            return { success: false, error: "Request not found." };
        }

        await prisma.$transaction(async (tx) => {
            // Update the request status
            await tx.timelineChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    reviewedById: reviewerId,
                }
            });

            // Update the project's end date
            await tx.project.update({
                where: { id: request.projectId },
                data: {
                    endDate: request.newEndDate,
                }
            });

            // Also update the "General Tasks" milestone if it exists
            await tx.milestone.updateMany({
                where: {
                    projectId: request.projectId,
                    title: 'General Tasks'
                },
                data: {
                    dueDate: request.newEndDate,
                }
            });
            
            // Notify original requester
            await tx.notification.create({
                data: {
                    message: `Your timeline change request for project was approved.`,
                    link: `/projects/${request.projectId}?tab=timeline`,
                    recipientId: request.requestedById,
                    senderId: reviewerId
                }
            });
        });

        revalidatePath('/timeline-approvals');
        revalidatePath(`/projects/${request.projectId}`);
        revalidatePath(`/projects/${request.projectId}/milestones`);
        revalidatePath('/milestones');
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error("Failed to approve timeline change:", error);
        return { success: false, error: "An unexpected error occurred." };
    }
}

export async function rejectTimelineChange(requestId: string, reviewerId: string, notes: string) {
    if (!notes || notes.trim().length < 10) {
        return { success: false, error: "A rejection reason of at least 10 characters is required."}
    }
    try {
        const request = await prisma.timelineChangeRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                reviewedById: reviewerId,
                reviewNotes: notes,
            }
        });

        // Notify original requester
        await prisma.notification.create({
            data: {
                message: `Your timeline change request for project was rejected. Reason: ${notes}`,
                link: `/projects/${request.projectId}?tab=timeline`,
                recipientId: request.requestedById,
                senderId: reviewerId
            }
        });

        revalidatePath('/timeline-approvals');
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error("Failed to reject timeline change:", error);
        return { success: false, error: "An unexpected error occurred." };
    }
}
