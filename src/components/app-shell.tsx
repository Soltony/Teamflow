
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderKanban,
  GanttChartSquare,
  Home,
  PanelLeft,
  Settings,
  UsersRound,
  Building2,
  Milestone,
  ClipboardCheck,
  ClipboardList,
  AreaChart,
  User,
  Library,
  DollarSign,
  CheckSquare,
  ListTodo,
  Archive,
  Clock,
  ThumbsUp,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NibLogo } from "./logo";
import { NotificationBell } from "./notifications/notification-bell";
import { NAV_GROUPS, isNavItemActive, visibleGroups } from "./navigation";
import { useApprovalCount } from "@/hooks/use-approval-count";



function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isOpen, isMobile } = useSidebar();
  const { localUser, logout, hasPermission } = useAuth();
  const approvalCount = useApprovalCount();
  const router = useRouter();
  
  const userInitials = localUser
    ? `${localUser.firstName?.[0] ?? ''}${localUser.lastName?.[0] ?? ''}`.toUpperCase()
    : '...';
  
  const userName = localUser?.name ?? 'Loading...';
  const userEmail = localUser?.email ?? '...';
  
  // Groups whose every item is hidden by permission drop out entirely.
  const groups = visibleGroups(NAV_GROUPS, hasPermission);

  return (
    <Sidebar id="main-navigation" className={cn(className, "sidebar text-sidebar-foreground")}>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <NibLogo className="w-8 h-8" />
          {(isOpen || isMobile) && <h1 className="text-xl font-semibold text-sidebar-foreground truncate">NIB EPMO</h1>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            {/*
              The heading is hidden when the rail is collapsed to icons, where
              there is no room for it — the grouping still shows as spacing.
            */}
            {(isOpen || isMobile) && (
              <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {group.label}
              </p>
            )}
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    href={item.href}
                    isActive={isNavItemActive(item, pathname)}
                    icon={<item.icon />}
                    // Only the approvals entry claims a badge, and only when
                    // there is actually something waiting.
                    badge={item.badge === 'approvals' && approvalCount ? approvalCount : undefined}
                    badgeLabel={
                      item.badge === 'approvals' && approvalCount
                        ? `${approvalCount} awaiting your decision`
                        : undefined
                    }
                  >
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="justify-start w-full gap-2 px-2">
              <Avatar className="w-8 h-8">
                 <AvatarImage src={localUser?.avatar ?? undefined} />
                 <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              {(isOpen || isMobile) && <span className="text-sm font-medium truncate">{userName}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isMobile, toggleSidebar, isOpen } = useSidebar();

  return (
    <div
      className={cn(
        "min-h-screen w-full",
      )}
    >
      {/*
        Visible only once focused, which is the point: a keyboard user would
        otherwise tab through every sidebar link on every page before reaching
        the content. Placed first so it is the very first stop.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to content
      </a>
      <AppSidebar />
      <main className={cn(
        "flex flex-col flex-1",
        !isMobile && (isOpen ? "pl-[280px]" : "pl-[56px]"),
        "transition-all duration-300 ease-in-out"
      )}>
        <header
          className={cn(
            "sticky top-0 z-10 flex items-center h-16 gap-4 px-4 border-b shrink-0 sm:px-6",
             'bg-background'
          )}
        >
          {/*
            `aria-expanded` and a label that says which way it goes: this was
            "Toggle Menu" with no indication of the current state, so a screen
            reader user could not tell whether pressing it would open or close
            the navigation.
          */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-expanded={isOpen}
            aria-controls="main-navigation"
            aria-label={isOpen ? "Collapse navigation" : "Expand navigation"}
          >
            <PanelLeft className="w-6 h-6" aria-hidden="true" />
          </Button>
           <div className="flex items-center gap-4 ml-auto">
              <NotificationBell />
            </div>
        </header>
        {/* tabIndex -1 so the skip link can move focus here, not just scroll. */}
        <div
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto overflow-x-hidden focus:outline-none"
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}
