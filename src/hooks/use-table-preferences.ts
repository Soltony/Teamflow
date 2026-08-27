'use client';

import * as React from 'react';

import { getTablePreferences, saveTablePreferences } from '@/app/preferences/actions';

/**
 * A table's layout, remembered for this person.
 *
 * Optimistic: the choice applies immediately and is written in the background,
 * because waiting on a round trip to show a column the reader just ticked
 * makes the control feel broken. A failed write costs them the preference next
 * time, not the interaction now.
 *
 * Saves are debounced so dragging through six checkboxes is one write rather
 * than six, and the first render uses the defaults until the stored value
 * arrives — which avoids a flash of the wrong columns on every page load.
 */
export function useTablePreferences<T extends { columns?: string[]; sort?: { column: string; direction: 'asc' | 'desc' } }>(
  tableKey: string,
  defaults: T,
): [T, (next: Partial<T>) => void, { loaded: boolean }] {
  const [value, setValue] = React.useState<T>(defaults);
  const [loaded, setLoaded] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getTablePreferences(tableKey)
      .then((stored) => {
        if (cancelled) return;
        if (stored) setValue((current) => ({ ...current, ...stored }) as T);
      })
      // A missing preference is the normal case, and a failed read should
      // leave the table working on its defaults rather than reporting an error
      // about a layout.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [tableKey]);

  const update = React.useCallback(
    (next: Partial<T>) => {
      setValue((current) => {
        const merged = { ...current, ...next } as T;

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          void saveTablePreferences(tableKey, merged).catch(() => undefined);
        }, 600);

        return merged;
      });
    },
    [tableKey],
  );

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return [value, update, { loaded }];
}
