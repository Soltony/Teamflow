'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/guard";
import { auditAction } from "@/lib/auth/audit-context";
import { AUDIT_ACTIONS } from "@/lib/audit-log";
import { serialize } from '@/lib/serialize';

export async function getPendingPayments() {
    await requirePermission('payment-approvals:view');

    const payments = await prisma.payment.findMany({
        where: {
            status: 'PENDING',
        },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                    currency: true,
                    // So the queue can say what share of the project's budget a
                    // payment represents. An amount on its own does not tell an
                    // approver whether it is a deposit or the whole contract.
                    totalCost: true,
                }
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    });

    return serialize(payments);
}

/**
 * Approves a payment.
 *
 * The approver is taken from the session and recorded on the payment, so every
 * financial decision is attributable. Previously this action required no
 * permission and stored no approver at all.
 */
export async function approvePayment(paymentId: string, notes?: string) {
    try {
        const approver = await requirePermission('payment-approvals:manage');

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            select: { status: true, title: true, amount: true, projectId: true },
        });
        if (!payment) {
            return { success: false, error: "Payment not found." };
        }
        if (payment.status !== 'PENDING') {
            return { success: false, error: `This payment has already been ${payment.status.toLowerCase()}.` };
        }

        await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'APPROVED',
                notes: notes,
                decidedById: approver.id,
                decidedAt: new Date(),
            }
        });

        await auditAction(approver, {
            action: AUDIT_ACTIONS.PAYMENT_APPROVED,
            entity: 'Payment',
            entityId: paymentId,
            details: {
                title: payment.title,
                amount: payment.amount,
                projectId: payment.projectId,
                from: payment.status,
                to: 'APPROVED',
                notes,
            },
        });

        revalidatePath('/payment-approvals');
        revalidatePath('/payments');
        return { success: true };
    } catch (error) {
        console.error("Failed to approve payment:", error);
        return { success: false, error: "An unexpected error occurred while approving the payment." };
    }
}

export async function rejectPayment(paymentId: string, notes: string) {
    if (!notes || notes.trim().length < 10) {
        return { success: false, error: "A rejection reason of at least 10 characters is required."}
    }
    try {
        const approver = await requirePermission('payment-approvals:manage');

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            select: { status: true, title: true, amount: true, projectId: true },
        });
        if (!payment) {
            return { success: false, error: "Payment not found." };
        }
        if (payment.status !== 'PENDING') {
            return { success: false, error: `This payment has already been ${payment.status.toLowerCase()}.` };
        }

        await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'REJECTED',
                notes: notes,
                decidedById: approver.id,
                decidedAt: new Date(),
            }
        });

        await auditAction(approver, {
            action: AUDIT_ACTIONS.PAYMENT_REJECTED,
            entity: 'Payment',
            entityId: paymentId,
            details: {
                title: payment.title,
                amount: payment.amount,
                projectId: payment.projectId,
                from: payment.status,
                to: 'REJECTED',
                reason: notes,
            },
        });

        revalidatePath('/payment-approvals');
        revalidatePath('/payments');
        return { success: true };
    } catch (error) {
        console.error("Failed to reject payment:", error);
        return { success: false, error: "An unexpected error occurred while rejecting the payment." };
    }
}
