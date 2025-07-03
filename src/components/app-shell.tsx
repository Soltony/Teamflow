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
  Wrench,
} from "lucide-react";
import { useTheme } from "next-themes";
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
import { ThemeToggle } from "./theme-toggle";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home, permission: 'dashboard:view' },
  { href: "/my-tasks", label: "My Tasks", icon: ClipboardCheck, permission: 'my-tasks:view' },
  { href: "/team-view", label: "Team View", icon: ClipboardList, permission: 'team-view:view' },
  { href: "/projects", label: "Projects", icon: FolderKanban, permission: 'projects:read' },
  { href: "/milestones", label: "Milestones", icon: Milestone, permission: 'milestones:view' },
  { href: "/gantt", label: "Gantt", icon: GanttChartSquare, permission: 'gantt:view' },
  { href: "/departments", label: "Departments", icon: Building2, permission: 'departments:read' },
  { href: "/teams", label: "Teams", icon: UsersRound, permission: 'teams:read' },
  { href: "/settings", label: "Settings", icon: Settings, permission: 'settings:manage' },
  { href: "/config", label: "Config", icon: Wrench, permission: ['config:manage-users', 'config:manage-roles'] },
];

function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isOpen, isMobile } = useSidebar();
  const { localUser, logout, hasPermission } = useAuth();
  
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
    <Sidebar className={cn(className, "text-muted-foreground")}>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <GanttChartSquare className="w-8 h-8 text-primary" />
          {(isOpen || isMobile) && <h1 className="text-xl font-semibold text-foreground truncate">TeamFlow</h1>}
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
            <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AuthLoadingScreen() {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <GanttChartSquare className="w-12 h-12 text-primary animate-pulse" />
                <p className="text-muted-foreground">Loading your workspace...</p>
            </div>
        </div>
    );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { isMobile, toggleSidebar, isOpen, mounted } = useSidebar();
  const { accessToken, loading, localUser } = useAuth();
  const router = useRouter();
  
  React.useEffect(() => {
    if (!loading && !accessToken) {
        router.replace('/login');
    }
  }, [loading, accessToken, router]);

  if (loading || !accessToken || !localUser) {
    return <AuthLoadingScreen />;
  }

  const isLightFrame = mounted && theme === 'light';

  return (
    <div
      className={cn(
        "min-h-screen w-full",
        !isMobile && (isOpen ? "pl-[280px]" : "pl-[56px]"),
        "transition-all duration-300 ease-in-out"
      )}
    >
      <AppSidebar className={isLightFrame ? 'dark' : ''} />
      <div className="flex flex-col">
        <header
          className={cn(
            "sticky top-0 z-10 flex items-center h-16 gap-4 px-4 border-b sm:px-6",
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
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
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
