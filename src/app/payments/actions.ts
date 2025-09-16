
'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getPaymentsPageData() {
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

    return JSON.parse(JSON.stringify(projectsWithCost));
}

export async function requestPayment(paymentId: string) {
    try {
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
