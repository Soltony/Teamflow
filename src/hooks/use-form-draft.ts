'use client';

import * as React from 'react';

/**
 * Keeps an unfinished form from being lost.
 *
 * A six-step project form is several minutes of work, and until it is
 * submitted none of it exists anywhere. A refresh, a closed tab, a session
 * that expired while somebody was reading a milestone spec — any of them threw
 * the lot away with no warning.
 *
 * Deliberately `sessionStorage` rather than the database:
 *
 *  - a draft is not a record. Writing half a project to the server means
 *    deciding what a project with no name and no dates *is*, and every list
 *    and count in the system then has to know to exclude it.
 *  - `sessionStorage` rather than `localStorage` because a draft is scoped to
 *    the sitting. Reopening the create form next week and finding last week's
 *    abandoned attempt pre-filled is worse than starting clean.
 *
 * Dates are the only awkward part: JSON turns them into strings, so they are
 * revived on read. The shared schema accepts either, but react-hook-form's
 * date pickers need real Date objects.
 */

const PREFIX = 'nibteam:draft:';

/** ISO-8601 with a time component — what JSON.stringify produces for a Date. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function reviveDates(value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, reviveDates(v)]),
    );
  }
  return value;
}

export interface FormDraft<T> {
  /** What was stored, or null if there is nothing usable. */
  draft: T | null;
  /** Writes the current values. Debounced by the caller's change cadence. */
  save: (values: T) => void;
  /** Forgets the draft — call after a successful submit. */
  clear: () => void;
  /** When the draft was last written, for telling the reader. */
  savedAt: Date | null;
}

export function useFormDraft<T>(key: string, enabled = true): FormDraft<T> {
  const storageKey = `${PREFIX}${key}`;
  const [draft, setDraft] = React.useState<T | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read once on mount. Storage can throw — private browsing, a locked-down
  // profile — and a form that will not render because a draft could not be
  // read is far worse than a form with no draft.
  React.useEffect(() => {
    if (!enabled) return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { at: string; values: unknown };
      setDraft(reviveDates(parsed.values) as T);
      setSavedAt(new Date(parsed.at));
    } catch {
      // A draft written by an older version of the form is not an error, it is
      // out of date. Ignore it and let the form start from its defaults.
    }
  }, [storageKey, enabled]);

  const save = React.useCallback(
    (values: T) => {
      if (!enabled) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          const at = new Date();
          window.sessionStorage.setItem(
            storageKey,
            JSON.stringify({ at: at.toISOString(), values }),
          );
          setSavedAt(at);
        } catch {
          // Storage full or unavailable. Losing the draft is bad; breaking the
          // form the reader is currently typing into is worse.
        }
      }, 800);
    },
    [storageKey, enabled],
  );

  const clear = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      /* nothing to do */
    }
    setDraft(null);
    setSavedAt(null);
  }, [storageKey]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { draft, save, clear, savedAt };
}
