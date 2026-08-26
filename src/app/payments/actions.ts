
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { serialize } from '@/lib/serialize';

export async function getPaymentsPageData() {
    // Contract values and payment schedules were previously returned to any
    // caller, with only the sidebar hiding the page.
    await requirePermission('payments:view');

    const projectsWithCost = await prisma.project.findMany({
        where: {
            totalCost: {
                not: null,
            },
        },
        include: {
            payments: {
                 orderBy: {
                    paymentDate: 'asc',
                }
            },
        },
        orderBy: {
            name: 'asc'
        }
    });

    return serialize(projectsWithCost);
}

export async function requestPayment(paymentId: string) {
    try {
        await requirePermission('payments:view');
        await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'PENDING',
            }
        });

        revalidatePath('/payments');
        revalidatePath('/payment-approvals');
        return { success: true };

    } catch (error) {
        console.error("Failed to request payment:", error);
        return { success: false, error: "An unexpected error occurred while requesting the payment." };
    }
}
