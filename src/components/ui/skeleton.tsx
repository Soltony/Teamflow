import { cn } from "@/lib/utils"

/**
 * A placeholder block, shown while real content loads.
 *
 * Purely decorative: it is hidden from assistive technology, because a screen
 * reader announcing eleven grey rectangles is worse than silence. The
 * announcement belongs on the region as a whole — see `LoadingRegion`.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // motion-safe: the pulse only runs for readers who have not asked for
        // reduced motion. A full page of pulsing blocks is a real problem for
        // anyone with a vestibular disorder.
        "motion-safe:animate-pulse rounded-md bg-muted",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  )
}

/**
 * Wraps a set of skeletons so the wait is announced.
 *
 * Every loading state in this application was silent: the screen was empty,
 * then content appeared, and a screen reader said nothing in between. `busy`
 * and a live region fix that without adding visual noise.
 */
function LoadingRegion({
  children,
  label = "Loading",
  className,
}: {
  children: React.ReactNode
  /** Say what is loading — "Loading projects" beats "Loading". */
  label?: string
  className?: string
}) {
  return (
    <div className={className} role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

export { Skeleton, LoadingRegion }
