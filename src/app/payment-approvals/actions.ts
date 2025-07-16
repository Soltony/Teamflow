
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getPendingPayments() {
    const payments = await prisma.milestonePayment.findMany({
        where: {
            status: 'PENDING',
        },
        include: {
            milestone: {
                select: {
                    title: true,
                    project: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    });

    return JSON.parse(JSON.stringify(payments));
}

export async function approvePayment(paymentId: string, notes?: string) {
    try {
        await prisma.milestonePayment.update({
            where: { id: paymentId },
            data: {
                status: 'APPROVED',
                notes: notes,
            }
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
        await prisma.milestonePayment.update({
            where: { id: paymentId },
            data: {
                status: 'REJECTED',
                notes: notes,
            }
        });
        revalidatePath('/payment-approvals');
        revalidatePath('/payments');
        return { success: true };
    } catch (error) {
        console.error("Failed to reject payment:", error);
        return { success: false, error: "An unexpected error occurred while rejecting the payment." };
    }
}
