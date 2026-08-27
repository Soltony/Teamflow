
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/**
 * Three sizes, not two.
 *
 * The old split was "mobile below 768, desktop above", which left every tablet
 * — the 768–1024 band, where a good deal of this system is actually read —
 * being treated as a desktop and given a 280px fixed rail. On a 768px screen
 * that is 36% of the viewport spent on navigation, and the content beside it
 * had 488px to fit tables that assume far more.
 *
 * A tablet now gets the icon rail by default: the same navigation, 56px wide,
 * expandable on demand.
 */
type Viewport = "mobile" | "tablet" | "desktop"

function viewportOf(width: number): Viewport {
  if (width < 768) return "mobile"
  if (width < 1024) return "tablet"
  return "desktop"
}

type SidebarContextProps = {
  isOpen: boolean
  isMobile: boolean
  viewport: Viewport
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
  const [viewport, setViewport] = React.useState<Viewport>("desktop")
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)

    // The last band we settled on. Compared against on every resize so the
    // sidebar is only reset when the viewport genuinely crosses a boundary —
    // the previous version called setIsOpen on *every* resize event, so a
    // reader who collapsed the rail had it spring back open the moment they
    // nudged the window, opened dev tools, or zoomed.
    let current: Viewport | null = null

    const apply = () => {
      const next = viewportOf(window.innerWidth)
      if (next === current) return
      current = next
      setViewport(next)
      setIsOpen(next === "desktop")
    }

    apply()
    window.addEventListener("resize", apply)
    return () => window.removeEventListener("resize", apply)
  }, [])

  const toggleSidebar = () => setIsOpen((open) => !open)

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isMobile: viewport === "mobile",
        viewport,
        toggleSidebar,
        setIsOpen,
        mounted,
      }}
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
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
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
  /** A live count beside the label — currently only the approvals inbox. */
  badge?: number
  /** What the count means, for a screen reader. "12" alone says nothing. */
  badgeLabel?: string
}

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, icon, isActive, children, href, badge, badgeLabel, ...props }, ref) => {
  const { isOpen, isMobile } = useSidebar()

  const variant: "secondary" | "ghost" = isActive ? "secondary" : "ghost";
  const collapsed = !isOpen && !isMobile
  const hasBadge = typeof badge === "number" && badge > 0

  /**
   * The label survives the collapse.
   *
   * Collapsed, these rendered as an icon and nothing else — no text, no label —
   * so every one of the eighteen nav items announced as an unnamed button, and
   * the whole rail was unusable by screen reader. The visible text is hidden
   * rather than dropped, and `title` gives sighted readers the same thing on
   * hover, which the icon-only rail also lacked.
   */
  const label = typeof children === "string" ? children : undefined

  const commonProps = {
    variant,
    title: collapsed ? [label, badgeLabel].filter(Boolean).join(" — ") : undefined,
    // Collapsed, the count has no room to render, so it has to go in the name
    // or it is lost entirely.
    "aria-label": collapsed
      ? [label, badgeLabel].filter(Boolean).join(", ")
      : undefined,
    // Marks the current page for assistive technology, which colour alone
    // could not: the active item was distinguishable only by its background.
    "aria-current": isActive ? ("page" as const) : undefined,
    className: cn(
      "h-10 w-full justify-start gap-3",
      collapsed && "h-10 w-10 justify-center p-0",
      className
    ),
    ...props
  };

  const buttonContent = (
    <>
      <span className="relative shrink-0">
        {icon && React.cloneElement(icon, { className: "h-5 w-5 shrink-0" })}
        {/*
          Collapsed there is no room for a number, so the icon carries a dot
          instead — enough to say "there is something here" and send the reader
          to expand the rail. The count itself is in the accessible name.
        */}
        {hasBadge && collapsed && (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-sidebar"
            aria-hidden="true"
          />
        )}
      </span>
      <span className={cn("truncate", collapsed && "sr-only")}>{children}</span>
      {hasBadge && !collapsed && (
        <span
          className="ml-auto shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold tabular-nums text-destructive-foreground"
          aria-hidden="true"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {/* The number, said once, in words that explain it. */}
      {hasBadge && !collapsed && <span className="sr-only">{badgeLabel ?? `${badge} pending`}</span>}
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
