
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

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home, permission: 'dashboard:view' },
  { href: "/my-tasks", label: "My Tasks", icon: ClipboardCheck, permission: 'my-tasks:view' },
  { href: "/team-view", label: "Team View", icon: ClipboardList, permission: 'team-view:view' },
  { href: "/projects", label: "Projects", icon: FolderKanban, permission: 'projects:read' },
  { href: "/milestones", label: "Milestones", icon: Milestone, permission: 'milestones:view' },
  { href: "/gantt", label: "Gantt", icon: GanttChartSquare, permission: 'gantt:view' },
  { href: "/pmo-divisions", label: "PMO Divisions", icon: Library, permission: 'pmo-divisions:view' },
  { href: "/departments", label: "Departments", icon: Building2, permission: 'departments:read' },
  { href: "/teams", label: "Teams", icon: UsersRound, permission: 'teams:read' },
  { href: "/payments", label: "Payments", icon: DollarSign, permission: 'payments:view' },
  { href: "/payment-approvals", label: "Payment Approvals", icon: CheckSquare, permission: 'payment-approvals:view' },
  { href: "/ceo-report", label: "Reports", icon: AreaChart, permission: 'reports:view' },
  { href: "/settings", label: "Settings", icon: Settings, permission: ['settings:manage', 'config:manage-users', 'config:manage-roles'] },
];

function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isOpen, isMobile } = useSidebar();
  const { localUser, logout, hasPermission } = useAuth();
  const router = useRouter();
  
  const userInitials = localUser
    ? `${localUser.firstName?.[0] ?? ''}${localUser.lastName?.[0] ?? ''}`.toUpperCase()
    : '...';
  
  const userName = localUser?.name ?? 'Loading...';
  const userEmail = localUser?.email ?? '...';
  
  const visibleMenuItems = menuItems.filter(item => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  return (
    <Sidebar className={cn(className, "sidebar text-sidebar-foreground")}>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <NibLogo className="w-8 h-8" />
          {(isOpen || isMobile) && <h1 className="text-xl font-semibold text-sidebar-foreground truncate">NIB EPMO</h1>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {visibleMenuItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                href={item.href}
                isActive={pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')}
                icon={<item.icon />}
              >
                {item.label}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="justify-start w-full gap-2 px-2">
              <Avatar className="w-8 h-8">
                 <AvatarImage src={localUser?.avatar} />
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
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            <PanelLeft className="w-6 h-6" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
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
