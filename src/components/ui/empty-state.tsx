import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { FolderOpen, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * What to show when there is nothing to show.
 *
 * Fifty-one places wrote their own version of this, with different markup,
 * different wording, and — the part that actually misleads people — no
 * distinction between two situations that need opposite advice:
 *
 *  - **Nothing exists yet.** The right move is to create the first one.
 *  - **A filter matched nothing.** Things do exist; the right move is to widen
 *    the search. The projects list told anyone whose search came up empty to
 *    "get started by creating a new project", which is both wrong and implies
 *    the portfolio is empty when it is not.
 *
 * Those are `variant="empty"` and `variant="no-match"`. A third, `"none-yours"`,
 * covers a list scoped to one person — no tasks assigned to you is a normal
 * state and should not be dressed up as a problem.
 */

export type EmptyStateVariant = 'empty' | 'no-match' | 'none-yours';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  /** The headline. Say what is missing, not "no data". */
  title: string;
  /** One line of context or advice. Optional — silence beats filler. */
  description?: string;
  /** Overrides the icon chosen for the variant. */
  icon?: LucideIcon;
  /**
   * The way forward. Omit it entirely when the reader cannot act — telling
   * somebody without create permission to add a project is worse than saying
   * nothing.
   */
  action?: { label: string; onClick: () => void } | React.ReactNode;
  className?: string;
  /** Smaller padding, for an empty panel inside a card rather than a page. */
  compact?: boolean;
}

const DEFAULT_ICON: Record<EmptyStateVariant, LucideIcon> = {
  empty: FolderOpen,
  'no-match': SearchX,
  'none-yours': FolderOpen,
};

export function EmptyState({
  variant = 'empty',
  title,
  description,
  icon,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const Icon = icon ?? DEFAULT_ICON[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-16',
        className,
      )}
      // Announced to a screen reader when a search returns nothing, which is
      // otherwise a silent change: the list simply vanishes.
      role="status"
    >
      <Icon
        className={cn('text-muted-foreground', compact ? 'h-6 w-6' : 'h-10 w-10')}
        aria-hidden="true"
      />
      <p className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <div className="mt-2">
          {React.isValidElement(action) ? (
            action
          ) : isActionObject(action) ? (
            <Button onClick={action.onClick}>{action.label}</Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function isActionObject(
  action: EmptyStateProps['action'],
): action is { label: string; onClick: () => void } {
  return (
    typeof action === 'object' &&
    action !== null &&
    'label' in action &&
    'onClick' in action
  );
}
