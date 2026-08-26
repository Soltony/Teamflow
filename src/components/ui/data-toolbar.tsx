'use client';

import * as React from 'react';
import { ArrowDownUp, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Search, filter, sort — the same controls, in the same order, on every list.
 *
 * Before this, Projects had a search box and two filters; Milestones had
 * nothing; the approval queues had nothing; Teams had a search box in a
 * different place with different placeholder wording. Nothing anywhere could be
 * sorted, and no screen told you how many rows you were looking at or which
 * filters were narrowing them — so an empty list was indistinguishable from a
 * filter left on from a previous visit.
 *
 * The parts, in the order they read:
 *
 *  - the search field, always first and always left;
 *  - filters, in a row that wraps;
 *  - sort, always last, always right;
 *  - beneath them, the count and a chip per active filter, each dismissible.
 */

export const ALL = 'all';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSpec {
  id: string;
  /** Shown in the trigger when nothing is chosen, and on the chip. */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Wording for the neutral option. Defaults to "All <label>". */
  allLabel?: string;
}

export interface SortSpec {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

export interface DataToolbarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Names what is being searched, for the screen-reader label. */
    label?: string;
  };
  filters?: FilterSpec[];
  sort?: SortSpec;
  /**
   * How many rows are showing, and out of how many. Stated because "9 of 47"
   * and "9 of 9" are different situations that look identical otherwise.
   */
  count?: { showing: number; total: number; noun: string };
  /** Clears everything. Rendered only when something is actually set. */
  onClearAll?: () => void;
  /** Create buttons and the like, pinned to the right of the control row. */
  actions?: React.ReactNode;
  className?: string;
}

export function DataToolbar({
  search,
  filters = [],
  sort,
  count,
  onClearAll,
  actions,
  className,
}: DataToolbarProps) {
  const activeFilters = filters.filter((f) => f.value && f.value !== ALL);
  const searchActive = Boolean(search?.value.trim());
  const anythingActive = activeFilters.length > 0 || searchActive;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        {search && (
          <div className="relative min-w-0 flex-1 md:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Search…'}
              aria-label={search.label ?? search.placeholder ?? 'Search'}
              className="w-full pl-8"
            />
          </div>
        )}

        {filters.map((filter) => (
          <Select
            key={filter.id}
            value={filter.value || ALL}
            onValueChange={filter.onChange}
          >
            <SelectTrigger
              className="w-full md:w-[190px]"
              aria-label={`Filter by ${filter.label.toLowerCase()}`}
            >
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{filter.allLabel ?? `All ${filter.label.toLowerCase()}`}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {sort && (
          <Select value={sort.value} onValueChange={sort.onChange}>
            <SelectTrigger className="w-full md:ml-auto md:w-[200px]" aria-label="Sort by">
              <ArrowDownUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {sort.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {actions && (
          <div className={cn('flex flex-wrap items-center gap-2', !sort && 'md:ml-auto')}>
            {actions}
          </div>
        )}
      </div>

      {(count || anythingActive) && (
        <div className="flex flex-wrap items-center gap-2">
          {count && (
            // A live region: filtering changes this number without moving
            // focus, which is otherwise a silent change to a screen reader.
            <p className="text-sm text-muted-foreground tabular-nums" role="status" aria-live="polite">
              {count.showing === count.total
                ? `${count.total} ${count.noun}`
                : `${count.showing} of ${count.total} ${count.noun}`}
            </p>
          )}

          {searchActive && search && (
            <FilterChip label="Search" value={search.value} onRemove={() => search.onChange('')} />
          )}

          {activeFilters.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              value={
                filter.options.find((o) => o.value === filter.value)?.label ?? filter.value
              }
              onRemove={() => filter.onChange(ALL)}
            />
          ))}

          {anythingActive && onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="h-7 px-2 text-xs">
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One active filter, shown as a dismissible chip.
 *
 * The point is that a narrowed list says so. A select whose value scrolled out
 * of view is not a visible filter, and people conclude the data is missing.
 */
export function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="gap-1 py-1 pl-2.5 pr-1 font-normal">
      <span className="text-muted-foreground">{label}:</span>
      <span className="max-w-[16ch] truncate font-medium">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="ml-0.5 rounded-full p-0.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}

/**
 * The bar that appears when rows are selected.
 *
 * Anchored to the bottom of the viewport rather than the top of the list: on a
 * long table the selection happens where you are scrolled to, and a bar at the
 * top of the page is a bar you cannot see.
 */
export function BulkActionBar({
  selectedCount,
  noun,
  onClear,
  children,
}: {
  selectedCount: number;
  noun: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-lg border bg-popover px-4 py-3 shadow-lg"
    >
      <span className="text-sm font-medium tabular-nums" role="status" aria-live="polite">
        {selectedCount} {selectedCount === 1 ? noun : `${noun}s`} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Cancel
      </Button>
    </div>
  );
}
