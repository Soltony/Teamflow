"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  School,
  Home,
  PanelLeft,
  Settings,
  UsersRound,
  Building2,
  Milestone,
  ClipboardCheck,
  ClipboardList,
  GanttChartSquare,
} from "lucide-react";
import { useTheme } from "next-themes";

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
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/my-tasks", label: "My Tasks", icon: ClipboardCheck },
  { href: "/team-view", label: "Team View", icon: ClipboardList },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/milestones", label: "Milestones", icon: Milestone },
  { href: "/gantt", label: "Gantt", icon: GanttChartSquare },
  { href: "/departments", label: "Departments", icon: Building2 },
  { href: "/teams", label: "Teams", icon: UsersRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isOpen, isMobile } = useSidebar();

  return (
    <Sidebar className={className}>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <GanttChartSquare className="w-8 h-8 text-primary" />
          {(isOpen || isMobile) && <h1 className="text-xl font-semibold text-primary truncate">NIB Team</h1>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
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
                <AvatarImage src="https://i.pravatar.cc/150?u=admin" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
              {(isOpen || isMobile) && <span className="text-sm font-medium truncate">Admin User</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Admin</p>
                <p className="text-xs leading-none text-muted-foreground">
                  admin@nibteam.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { isMobile, toggleSidebar, isOpen, mounted } = useSidebar();
  
  const isLightFrame = mounted && theme === 'light';

  if (!mounted) {
    // Render a placeholder or null to avoid hydration mismatch
    return (
       <div
        className={cn(
            "min-h-screen w-full",
            "pl-[56px]", // Use a fixed value for SSR
            "transition-all duration-300 ease-in-out"
        )}
        >
            <aside className={cn("fixed left-0 top-0 z-20 h-screen border-r bg-background transition-[width] duration-300 ease-in-out", "w-[56px]")}>
                {/* Simplified sidebar for SSR */}
            </aside>
             <div className="flex flex-col">
                <header className="sticky top-0 z-10 flex items-center h-16 gap-4 px-4 border-b bg-background sm:px-6">
                     <Button variant="ghost" size="icon" disabled>
                        <PanelLeft className="w-6 h-6" />
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
            "sticky top-0 z-10 flex items-center h-16 gap-4 px-4 border-b bg-background sm:px-6",
            isLightFrame && 'dark'
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
