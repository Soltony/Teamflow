
'use server';

import prisma from "@/lib/db";
import { notifyOne } from "@/lib/notifications/notify";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { auditAction } from "@/lib/auth/audit-context";
import { AUDIT_ACTIONS } from "@/lib/audit-log";
import { GENERAL_TASKS_TITLE } from "@/lib/services/milestones";
import { serialize } from '@/lib/serialize';

export async function getPendingTimelineChanges() {
    await requirePermission('timeline:approve');

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

    return serialize(requests);
}

/**
 * Approves a timeline extension.
 *
 * The reviewer is the session user, not the caller-supplied `_reviewerId`, and
 * may not be the person who requested the change — previously a project
 * manager could approve their own deadline extension.
 */
export async function approveTimelineChange(requestId: string, _reviewerId?: string) {
    try {
        const reviewer = await requirePermission('timeline:approve');
        const reviewerId = reviewer.id;

        const request = await prisma.timelineChangeRequest.findUnique({ where: { id: requestId } });
        if (!request) {
            return { success: false, error: "Request not found." };
        }
        if (request.status !== 'PENDING') {
            return { success: false, error: `This request has already been ${request.status.toLowerCase()}.` };
        }
        if (request.requestedById === reviewerId) {
            return { success: false, error: "You cannot approve a timeline change you requested yourself." };
        }

        const projectBefore = await prisma.project.findUnique({
            where: { id: request.projectId },
            select: { startDate: true, baselineEndDate: true },
        });

        await prisma.$transaction(async (tx) => {
            // Update the request status
            await tx.timelineChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    reviewedById: reviewerId,
                }
            });

            // Move the plan, not the yardstick.
            //
            // baselineEndDate is deliberately untouched: it holds the date the
            // project originally committed to, and every on-time and variance
            // figure is measured against it. Overwriting it here is what made
            // an extended project impossible to report as late.
            await tx.project.update({
                where: { id: request.projectId },
                data: {
                    endDate: request.newEndDate,
                    // Backfill for projects that predate baselining, so the
                    // original date is captured before this extension hides it.
                    ...(projectBefore?.baselineEndDate
                        ? {}
                        : {
                            baselineStartDate: projectBefore?.startDate,
                            baselineEndDate: request.oldEndDate,
                            baselineSetAt: new Date(),
                          }),
                }
            });

            // Carry the extension through to anything that would otherwise be
            // scheduled to finish after the project itself.
            //
            // Only the General Tasks holding milestone was moved before, so a
            // real milestone due on the old end date kept that date and the
            // project ended up with milestones falling due after it closed.
            // Milestones and tasks that already sit inside the new window are
            // left alone: an extension is not a reason to move work that was
            // never at risk.
            await tx.milestone.updateMany({
                where: {
                    projectId: request.projectId,
                    dueDate: { gt: request.newEndDate },
                },
                data: { dueDate: request.newEndDate },
            });

            await tx.milestone.updateMany({
                where: {
                    projectId: request.projectId,
                    title: GENERAL_TASKS_TITLE,
                },
                data: { dueDate: request.newEndDate },
            });

            await tx.task.updateMany({
                where: {
                    milestone: { projectId: request.projectId },
                    endDate: { gt: request.newEndDate },
                },
                data: { endDate: request.newEndDate },
            });
            
            // Notify original requester
            const project = await tx.project.findUnique({where: {id: request.projectId}, select: {name: true}});
            await notifyOne(
                tx,
                {
                    message: `Your timeline change request for project "${project?.name}" was approved.`,
                    link: `/projects/${request.projectId}?tab=timeline`,
                    senderId: reviewerId,
                },
                request.requestedById,
            );
        });

        await auditAction(reviewer, {
            action: AUDIT_ACTIONS.TIMELINE_CHANGE_APPROVED,
            entity: 'Project',
            entityId: request.projectId,
            details: {
                requestId,
                requestedById: request.requestedById,
                oldEndDate: request.oldEndDate,
                newEndDate: request.newEndDate,
                reason: request.reason,
            },
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

export async function rejectTimelineChange(requestId: string, _reviewerId: string | undefined, notes: string) {
    if (!notes || notes.trim().length < 10) {
        return { success: false, error: "A rejection reason of at least 10 characters is required."}
    }
    try {
        const reviewer = await requirePermission('timeline:approve');
        const reviewerId = reviewer.id;

        const existing = await prisma.timelineChangeRequest.findUnique({ where: { id: requestId } });
        if (!existing) {
            return { success: false, error: "Request not found." };
        }
        if (existing.status !== 'PENDING') {
            return { success: false, error: `This request has already been ${existing.status.toLowerCase()}.` };
        }
        if (existing.requestedById === reviewerId) {
            return { success: false, error: "You cannot reject a timeline change you requested yourself." };
        }

        const request = await prisma.timelineChangeRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                reviewedById: reviewerId,
                reviewNotes: notes,
            }
        });

        // Notify original requester
        const project = await prisma.project.findUnique({where: {id: request.projectId}, select: {name: true}});
        await notifyOne(
            prisma,
            {
                message: `Your timeline change request for project "${project?.name}" was rejected. Reason: ${notes}`,
                link: `/projects/${request.projectId}?tab=timeline`,
                senderId: reviewerId,
            },
            request.requestedById,
        );

        await auditAction(reviewer, {
            action: AUDIT_ACTIONS.TIMELINE_CHANGE_REJECTED,
            entity: 'Project',
            entityId: request.projectId,
            details: {
                requestId,
                requestedById: existing.requestedById,
                oldEndDate: existing.oldEndDate,
                newEndDate: existing.newEndDate,
                reviewNotes: notes,
            },
        });

        revalidatePath('/timeline-approvals');
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error("Failed to reject timeline change:", error);
        return { success: false, error: "An unexpected error occurred." };
    }
}
