'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Lock, RefreshCw, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * What to show when something went wrong.
 *
 * The failure paths in this system were a bare paragraph in a div: "Could not
 * load project data or you do not have permission to view it." That sentence
 * names two entirely different problems, offers no way out of either, and is
 * silent to a screen reader because nothing marks it as an alert.
 *
 * Three kinds, because they need three different next steps:
 *
 *  - `load` — it broke, and trying again is reasonable.
 *  - `permission` — it did not break; you may not see this. Retrying is futile,
 *    so the button goes somewhere you can actually use.
 *  - `not-found` — it is gone, or never existed.
 */

export type ErrorStateVariant = 'load' | 'permission' | 'not-found';

const PRESET: Record<
  ErrorStateVariant,
  { icon: React.ComponentType<{ className?: string }>; title: string; description: string }
> = {
  load: {
    icon: Unplug,
    title: 'We could not load this',
    description:
      'The request did not come back. This is usually temporary — try again, and if it keeps happening tell your administrator.',
  },
  permission: {
    icon: Lock,
    title: 'You do not have access to this',
    description:
      'Your account is not permitted to view this page. If you believe it should be, ask your administrator to grant it.',
  },
  'not-found': {
    icon: AlertTriangle,
    title: 'This no longer exists',
    description: 'It may have been deleted, or the link may be out of date.',
  },
};

export interface ErrorStateProps {
  variant?: ErrorStateVariant;
  title?: string;
  description?: string;
  /** The underlying message, when there is one worth showing. */
  detail?: string | null;
  /** Wires up a "Try again" button. Omit when retrying cannot help. */
  onRetry?: () => void;
  /** Somewhere useful to go instead. Defaults to the dashboard. */
  href?: string;
  hrefLabel?: string;
  className?: string;
  /** Smaller padding, for a panel inside a card rather than a whole page. */
  compact?: boolean;
}

export function ErrorState({
  variant = 'load',
  title,
  description,
  detail,
  onRetry,
  href,
  hrefLabel,
  className,
  compact = false,
}: ErrorStateProps) {
  const preset = PRESET[variant];
  const Icon = preset.icon;

  return (
    <div
      // `alert` rather than `status`: this interrupts, because the reader's
      // task cannot continue until they act on it.
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-16',
        className,
      )}
    >
      <Icon
        className={cn('text-destructive', compact ? 'h-6 w-6' : 'h-10 w-10')}
        aria-hidden="true"
      />
      <p className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
        {title ?? preset.title}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">{description ?? preset.description}</p>
      {detail && (
        // The raw message, kept visually quiet. Useful in a support ticket,
        // meaningless as a headline.
        <p className="max-w-md break-words font-mono text-xs text-muted-foreground/80">{detail}</p>
      )}
      {(onRetry || href) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          )}
          {(href || variant === 'permission') && (
            <Button asChild variant="outline">
              <Link href={href ?? '/dashboard'}>{hrefLabel ?? 'Go to dashboard'}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
