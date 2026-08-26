'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/guard';
import { serialize } from '@/lib/serialize';

/**
 * Notifications are always scoped to the signed-in user. The previous version
 * took the recipient id as an argument and applied no ownership check, so any
 * caller could read or silence another person's notifications.
 */

export async function getNotifications(_userId?: string) {
    const user = await requireUser();

    const notifications = await prisma.notification.findMany({
        where: { recipientId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit to recent 50
        include: {
            sender: {
                // Only what the bell renders — not the whole user record.
                select: { id: true, name: true, avatar: true },
            },
        },
    });
    return serialize(notifications);
}

export async function markNotificationAsRead(notificationId: string) {
    try {
        const user = await requireUser();

        // Scoped by recipientId, so this can only ever affect your own row.
        const result = await prisma.notification.updateMany({
            where: { id: notificationId, recipientId: user.id },
            data: { read: true },
        });

        if (result.count === 0) {
            return { success: false, error: 'Notification not found.' };
        }

        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        return { success: false, error: 'Could not update notification.' };
    }
}

export async function markAllNotificationsAsRead(_userId?: string) {
    try {
        const user = await requireUser();
        await prisma.notification.updateMany({
            where: { recipientId: user.id, read: false },
            data: { read: true },
        });
        revalidatePath('/notifications');
        return { success: true };
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        return { success: false, error: 'Could not update notifications.' };
    }
}
