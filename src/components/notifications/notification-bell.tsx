
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/app/notifications/actions';
import { useAuth } from '@/context/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Notification, User } from '@prisma/client';

type NotificationWithSender = Notification & { sender: User | null };

export function NotificationBell() {
  const { localUser } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationWithSender[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (localUser?.id) {
      const data = await getNotifications(localUser.id);
      setNotifications(data);
    }
  }, [localUser?.id]);

  useEffect(() => {
    // Fetch notifications when the component mounts and user is available
    if (localUser?.id) {
      fetchNotifications();
    }
  }, [localUser?.id, fetchNotifications]);
  
  useEffect(() => {
    // Fetch notifications when the dropdown is opened
    if (isOpen && localUser?.id) {
      fetchNotifications();
    }
  }, [isOpen, localUser?.id, fetchNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const handleNotificationClick = async (notification: NotificationWithSender) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
      // Immediately update UI before re-fetch for better UX
      setNotifications(prev => prev.map(n => n.id === notification.id ? {...n, read: true} : n));
    }
    if (notification.link) {
        router.push(notification.link);
    }
    setIsOpen(false);
  };
  
  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (localUser?.id) {
      await markAllNotificationsAsRead(localUser.id);
      // Immediately update UI
      setNotifications(prev => prev.map(n => ({...n, read: true})));
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96">
        <DropdownMenuLabel className="flex justify-between items-center">
            Notifications
            {unreadCount > 0 && (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={handleMarkAllAsRead}>
                    Mark all as read
                </Button>
            )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-96 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={() => handleNotificationClick(notification)}
                className="cursor-pointer data-[disabled]:cursor-not-allowed"
              >
                <div className="flex items-start gap-3 py-2">
                   {!notification.read && (
                    <Circle className="h-2 w-2 mt-1.5 flex-shrink-0 fill-primary text-primary" />
                   )}
                  <div className={cn("grid gap-1", notification.read && "pl-5")}>
                    <p className="text-sm font-medium leading-none">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              You have no new notifications.
            </div>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
