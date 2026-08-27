
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  KeyRound,
  LogOut,
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
  const { hasPermission } = useAuth();
  const approvalCount = useApprovalCount();

  // Groups whose every item is hidden by permission drop out entirely.
  const groups = visibleGroups(NAV_GROUPS, hasPermission);

  return (
    <Sidebar id="main-navigation" className={cn(className, "sidebar text-sidebar-foreground")}>
      <SidebarHeader>
        <div className="flex items-center gap-2.5">
          <NibLogo className="h-8 w-8" />
          {(isOpen || isMobile) && (
            <h1 className="truncate text-lg font-semibold tracking-tight text-sidebar-foreground">
              NIB EPMO
            </h1>
          )}
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
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
    </Sidebar>
  );
}

/**
 * Who you are signed in as, and the things you can do about it.
 *
 * This lived in the sidebar footer, which put it behind a collapse: on a
 * tablet the rail defaults to 56px, and on a phone it sat inside a drawer you
 * had to open first. The top bar is the one piece of chrome present at every
 * width, so the account controls live there and stay one action away.
 */
function UserMenu() {
  const { localUser, logout } = useAuth();

  const userName = localUser?.name ?? "Loading...";
  const userEmail = localUser?.email ?? "...";
  const userInitials = localUser
    ? `${localUser.firstName?.[0] ?? ""}${localUser.lastName?.[0] ?? ""}`.toUpperCase()
    : "...";
  // Someone can hold more than one role, and which ones they hold is the thing
  // that explains what they can see — so list them rather than picking one.
  const roleLabel = localUser?.roles?.map((role) => role.name).join(", ") || "No role assigned";

  return (
    <DropdownMenu>
      {/*
        The avatar alone. It sits beside the notification bell, so it takes the
        same 40px icon-button footprint — a name and role spelled out next to a
        bare bell read as two unrelated controls rather than one row of chrome.
        Who you are is one click away, in the menu's own header.
      */}
      <DropdownMenuTrigger className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={localUser?.avatar ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary-strong">
            {userInitials}
          </AvatarFallback>
        </Avatar>
        {/* The initials are decorative; this is the button's actual name. */}
        <span className="sr-only">Account menu for {userName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium leading-none">{userName}</p>
          {/*
            The role moved down here with the trigger's text. It was the one
            thing the header showed that the menu did not, so dropping the
            label without rehoming it would have lost it entirely.
          */}
          <p className="mt-1 truncate text-xs font-normal leading-none text-muted-foreground">
            {roleLabel}
          </p>
          <p className="mt-1 truncate text-xs font-normal leading-none text-muted-foreground">
            {userEmail}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/*
          Real links rather than router.push on click: these are navigations,
          so they should open in a new tab on a middle click and be reachable
          the way every other link in the system is.
        */}
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/change-password">
            <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
        {/*
          The chrome sits on the card surface rather than the page, so the rail
          and the top bar read as one continuous frame around the content —
          and the translucent blur keeps that frame legible while a long table
          scrolls under it.
        */}
        <header
          className={cn(
            "sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-border px-4 sm:px-6",
            "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
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
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <UserMenu />
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
