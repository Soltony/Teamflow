'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Sections of a record, as a list rather than a strip of tabs.
 *
 * The project page put four tabs in a `grid-cols-4` strip: "Milestones &
 * Tasks", "Blockers", "Documents", "Timeline History". At tablet width the
 * first label wrapped inside a 40px-tall box and clipped, and none of the tabs
 * could say how much was behind it — so the only way to find out whether a
 * project had open issues was to click and see.
 *
 * A vertical rail on desktop fixes both: labels get a full line each, and each
 * one carries its own count. Below `lg` it becomes a horizontally scrollable
 * row, which is the one place a scrolling strip is the right answer — there are
 * few enough items that they nearly fit, and the alternative is a select that
 * hides the counts again.
 *
 * Selection is driven by the parent so it can live in the URL; deep links like
 * `?tab=blockers` keep working unchanged.
 */

export interface Section {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Shown as a pill beside the label. Zero is hidden, not rendered as "0". */
  count?: number;
  /** Draws the count in the alert colour — open issues, pending approvals. */
  attention?: boolean;
  /** One line under the label on desktop. */
  description?: string;
}

export interface SectionNavProps {
  sections: Section[];
  value: string;
  onValueChange: (value: string) => void;
  /** Names the group for assistive technology. */
  label?: string;
  className?: string;
}

export function SectionNav({
  sections,
  value,
  onValueChange,
  label = 'Sections',
  className,
}: SectionNavProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Arrow keys move between sections, as they would in a real tab list. Radix
   * gave us this for free and it disappeared along with the tabs, so it is
   * reimplemented rather than dropped.
   */
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const last = sections.length - 1;
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = last;

    onValueChange(sections[next].id);
    refs.current[next]?.focus();
  };

  return (
    <nav
      aria-label={label}
      className={cn(
        // Scrolls sideways only while it is a row; the rail never does.
        'flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0',
        className,
      )}
    >
      {sections.map((section, index) => {
        const isActive = section.id === value;
        const Icon = section.icon;

        return (
          <button
            key={section.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`section-panel-${section.id}`}
            id={`section-tab-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onValueChange(section.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'group flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'lg:w-full lg:shrink lg:items-start lg:py-2.5',
              isActive
                ? 'bg-secondary text-secondary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {Icon && (
              <Icon
                className={cn('h-4 w-4 shrink-0 lg:mt-0.5', isActive && 'text-foreground')}
                aria-hidden="true"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate">{section.label}</span>
                {typeof section.count === 'number' && section.count > 0 && (
                  <Badge
                    variant={section.attention ? 'destructive' : 'secondary'}
                    className="h-5 shrink-0 px-1.5 text-[11px] tabular-nums"
                  >
                    {section.count}
                  </Badge>
                )}
              </span>
              {section.description && (
                <span className="mt-0.5 hidden text-xs font-normal leading-snug text-muted-foreground lg:block">
                  {section.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The panel a section's content lives in.
 *
 * Kept alongside the nav so the `role`/`aria-controls` pairing cannot drift:
 * the ids on both sides are derived from the same section id.
 */
export function SectionPanel({
  id,
  active,
  children,
  className,
}: {
  id: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!active) return null;

  return (
    <div
      role="tabpanel"
      id={`section-panel-${id}`}
      aria-labelledby={`section-tab-${id}`}
      tabIndex={0}
      className={cn(
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Rail plus panel, in the proportion the detail screens use.
 *
 * The rail is a fixed 260px on desktop rather than a fraction, so the content
 * column keeps the same width whatever the longest label happens to be.
 */
export function SectionLayout({
  nav,
  children,
  className,
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-6 lg:flex-row', className)}>
      <div className="lg:w-[260px] lg:shrink-0">
        {/* Follows the reader down a long milestones list. */}
        <div className="lg:sticky lg:top-20">{nav}</div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
