
'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getNotifications(userId: string) {
    const notifications = await prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit to recent 50
        include: { sender: true }
    });
    return JSON.parse(JSON.stringify(notifications));
}

export async function markNotificationAsRead(notificationId: string) {
    try {
        await prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
        revalidatePath('/notifications'); // This is a virtual path to trigger revalidation
        return { success: true };
    } catch (error) {
        console.error("Failed to mark notification as read:", error);
        return { success: false, error: "Could not update notification." };
    }
}

export async function markAllNotificationsAsRead(userId: string) {
    try {
        await prisma.notification.updateMany({
            where: { recipientId: userId, read: false },
            data: { read: true },
        });
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error("Failed to mark all notifications as read:", error);
        return { success: false, error: "Could not update notifications." };
    }
}
