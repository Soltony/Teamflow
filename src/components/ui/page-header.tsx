import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The top of every screen.
 *
 * Each page in this system built its own: some opened with a bare `<h1>`, some
 * with a Card whose title did the same job, some with nothing at all, and the
 * padding was written out by hand twenty-odd times with three different values.
 * The result was that no two screens started at the same vertical position and
 * the primary action turned up in a different place on each one.
 *
 * `PageShell` owns the page's padding and rhythm; `PageHeader` owns the title
 * block. Both are deliberately small — this is a layout contract, not a
 * component framework.
 */

export function PageShell({
  children,
  className,
  /** Constrains reading width. Forms and detail pages want this; tables do not. */
  width = 'full',
}: {
  children: React.ReactNode;
  className?: string;
  width?: 'full' | 'wide' | 'form';
}) {
  return (
    <div
      className={cn(
        'p-4 sm:p-6 space-y-6',
        width === 'wide' && 'mx-auto w-full max-w-7xl',
        width === 'form' && 'mx-auto w-full max-w-4xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Where you are, one level up.
 *
 * Rendered as an ordered list so a screen reader announces it as the trail it
 * is, and the last entry is marked current rather than being a link to the page
 * you are already on.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1 min-w-0">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-foreground" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface PageHeaderProps {
  title: React.ReactNode;
  /** One line saying what this screen is for. */
  description?: React.ReactNode;
  /** Primary and secondary actions, right-aligned on desktop. */
  actions?: React.ReactNode;
  /** Trail above the title. Prefer this to a lone back link on nested screens. */
  breadcrumbs?: Crumb[];
  /**
   * A single back link, for screens with no meaningful trail. Ignored when
   * breadcrumbs are given — two ways back is one too many.
   */
  backHref?: string;
  backLabel?: string;
  /** Status badges, owner, dates: the facts that identify this record. */
  meta?: React.ReactNode;
  className?: string;
  /** Rendered full-width beneath the header — risk strips, action banners. */
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  backHref,
  backLabel = 'Back',
  meta,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} />
      ) : backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
          {description && (
            <p className="prose-numerals max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
          {meta && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        {actions && (
          // Wraps rather than overflowing: on a tablet these are three or four
          // buttons that used to push the title off the screen.
          <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:shrink-0">{actions}</div>
        )}
      </div>

      {children}
    </div>
  );
}

/**
 * One fact in a header's meta row — an icon, a label, and a value.
 *
 * The label is not decoration: "PM: Amina" is readable, a bare avatar and a
 * name is a guess.
 */
export function PageMeta({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {label && <span className="shrink-0">{label}:</span>}
      <span className="truncate font-medium text-foreground">{children}</span>
    </span>
  );
}
