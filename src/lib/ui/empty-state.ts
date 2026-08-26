import type { EmptyStateVariant } from '@/components/ui/empty-state';

/**
 * Deciding which kind of empty a list is.
 *
 * Pure, so the decision can be tested without rendering anything. Every screen
 * was making this judgement inline and most were getting it wrong — the list
 * was empty, so they said "create the first one", regardless of whether a
 * search box had three words in it.
 */

export interface EmptyStateContext {
  /** Whether any filter, search or tab selection is currently narrowing the list. */
  filtersActive: boolean;
  /** Whether the list is inherently scoped to the reader, e.g. "my tasks". */
  scopedToUser?: boolean;
  /** Whether the reader is allowed to create the thing that is missing. */
  canCreate?: boolean;
}

export function emptyStateVariant(context: EmptyStateContext): EmptyStateVariant {
  // A filter beats everything: things may well exist behind it, so advice to
  // create a new one would be wrong.
  if (context.filtersActive) return 'no-match';
  if (context.scopedToUser) return 'none-yours';
  return 'empty';
}

/**
 * Whether to offer a create button.
 *
 * Only when the reader can actually create, and only when nothing is filtered —
 * offering "New project" to somebody whose search failed answers a question
 * they did not ask.
 */
export function shouldOfferCreate(context: EmptyStateContext): boolean {
  return Boolean(context.canCreate) && !context.filtersActive && !context.scopedToUser;
}

/**
 * Whether any of a set of filter values is narrowing the list.
 *
 * Treats empty strings, null, undefined and the conventional "all" sentinel as
 * "not filtering", which is what the filter controls in this application use
 * for their neutral option.
 */
export function anyFilterActive(...values: Array<unknown>): boolean {
  return values.some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      return trimmed !== '' && trimmed.toLowerCase() !== 'all';
    }
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'boolean') return v;
    return true;
  });
}
