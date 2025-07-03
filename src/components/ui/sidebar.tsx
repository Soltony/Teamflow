
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"

type SidebarContextProps = {
  isOpen: boolean
  isMobile: boolean
  toggleSidebar: () => void
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  mounted: boolean
}

const SidebarContext = React.createContext<SidebarContextProps | undefined>(
  undefined
)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(true)
  const [isMobile, setIsMobile] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true);
    const checkIsMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setIsOpen(!mobile)
    }
    checkIsMobile()
    window.addEventListener("resize", checkIsMobile)
    return () => window.removeEventListener("resize", checkIsMobile)
  }, [])

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return (
    <SidebarContext.Provider
      value={{ isOpen, isMobile, toggleSidebar, setIsOpen, mounted }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

const Sidebar = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen, isMobile, setIsOpen } = useSidebar()

  const sidebarContent = (
    <div className="flex h-full flex-col">{children}</div>
  )

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-r">
          <aside ref={ref} className={cn("h-full", className)} {...props}>
            {sidebarContent}
          </aside>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      ref={ref}
      className={cn(
        "fixed left-0 top-0 z-20 h-screen border-r bg-sidebar transition-[width] duration-300 ease-in-out",
        isOpen ? "w-[280px]" : "w-[56px]",
        className
      )}
      {...props}
    >
      {sidebarContent}
    </aside>
  )
})
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-16 shrink-0 items-center border-b px-4", className)}
    {...props}
  />
))
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
    const { isOpen, isMobile } = useSidebar()
    return (
        <div
        ref={ref}
        className={cn(
            "mt-auto shrink-0 border-t p-4 transition-all",
            !isOpen && !isMobile && "p-2",
            className
        )}
        {...props}
        />
    )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => {
  const { isOpen, isMobile } = useSidebar()
  return (
    <ul
      ref={ref}
      className={cn("space-y-1 p-4 transition-all", !isOpen && !isMobile && "px-2", className)}
      {...props}
    />
  )
})
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

interface SidebarMenuButtonProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  icon?: React.ReactElement
  isActive?: boolean
  href?: string
}

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, icon, isActive, children, href, ...props }, ref) => {
  const { isOpen, isMobile } = useSidebar()

  const commonProps = {
    variant: isActive ? "secondary" : "ghost" as const,
    className: cn(
      "h-10 w-full justify-start gap-3",
      !isOpen && !isMobile && "h-10 w-10 justify-center p-0",
      className
    ),
    ...props
  };

  const buttonContent = (
    <>
      {icon && React.cloneElement(icon, { className: "h-5 w-5 shrink-0" })}
      {(isOpen || isMobile) && <span className="truncate">{children}</span>}
    </>
  );

  if (href) {
    return (
      <Button {...commonProps} ref={ref} asChild>
        <Link href={href}>{buttonContent}</Link>
      </Button>
    )
  }

  return (
    <Button {...commonProps} ref={ref}>
      {buttonContent}
    </Button>
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
}
