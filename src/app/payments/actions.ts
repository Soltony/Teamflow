'use server';

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getPaymentsPageData() {
    const projectsWithCost = await prisma.project.findMany({
        where: {
            hasCost: true,
        },
        include: {
            milestones: {
                include: {
                    payments: true,
                },
                orderBy: {
                    dueDate: 'asc',
                }
            },
        },
        orderBy: {
            name: 'asc'
        }
    });

    return JSON.parse(JSON.stringify(projectsWithCost));
}


export async function addMilestonePayment(milestoneId: string, amount: number, paymentDate: Date) {
    try {
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: { payments: true }
        });

        if (!milestone || milestone.cost === null) {
            return { success: false, error: "Milestone not found or does not have a cost." };
        }

        const totalPaid = milestone.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
        const remaining = parseFloat(milestone.cost.toString()) - totalPaid;

        if (amount > remaining) {
            return { success: false, error: `Payment amount cannot exceed the remaining balance of ${remaining.toFixed(2)}.` };
        }

        await prisma.milestonePayment.create({
            data: {
                milestoneId,
                amount,
                paymentDate,
            }
        });

        revalidatePath('/payments');
        return { success: true };

    } catch (error) {
        console.error("Failed to add milestone payment:", error);
        return { success: false, error: "An unexpected error occurred while adding the payment." };
    }
}
