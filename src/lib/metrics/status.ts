/**
 * What a project status *means*.
 *
 * The authority is `ProjectStatus.category`, an immutable column, not the
 * status name. Names are labels users may rename in Settings; the application
 * used to branch on them in dozens of places, so renaming "Completed" silently
 * broke completion, archiving, overdue and every report at once.
 *
 * The name-based table below is a fallback only, for callers that hold a status
 * name without its row (older serialised payloads, and the seed data). New code
 * should pass the category.
 */

export type StatusCategory =
  /** Work is expected to be happening. */
  | 'ACTIVE'
  /** Deliberately paused; still the EPMO's problem. */
  | 'ON_HOLD'
  /** Delivered, being handed to the receiving department. */
  | 'HANDOVER'
  /** Finished. No further work expected. */
  | 'CLOSED'
  | 'UNKNOWN';

/** A status as the metrics functions need to see it. */
export interface StatusLike {
  name?: string | null;
  category?: StatusCategory | string | null;
}

const BY_NAME: Record<string, StatusCategory> = {
  active: 'ACTIVE',
  pending: 'ACTIVE',
  'in progress': 'ACTIVE',
  parked: 'ON_HOLD',
  'on hold': 'ON_HOLD',
  suspended: 'ON_HOLD',
  'on handover': 'HANDOVER',
  handover: 'HANDOVER',
  completed: 'CLOSED',
  complete: 'CLOSED',
  closed: 'CLOSED',
  cancelled: 'CLOSED',
};

const VALID: ReadonlySet<string> = new Set(['ACTIVE', 'ON_HOLD', 'HANDOVER', 'CLOSED']);

/**
 * Resolves a status to its category.
 *
 * Accepts either a status object (preferred — its `category` is authoritative)
 * or a bare name, which falls back to the lookup table.
 */
export function statusCategory(status: StatusLike | string | null | undefined): StatusCategory {
  if (!status) return 'UNKNOWN';

  if (typeof status === 'string') {
    return BY_NAME[status.trim().toLowerCase()] ?? 'UNKNOWN';
  }

  const declared = status.category;
  if (typeof declared === 'string' && VALID.has(declared)) {
    return declared as StatusCategory;
  }

  return status.name ? BY_NAME[status.name.trim().toLowerCase()] ?? 'UNKNOWN' : 'UNKNOWN';
}

/** Finished. Only these count towards completion metrics. */
export function isClosedStatus(status: StatusLike | string | null | undefined): boolean {
  return statusCategory(status) === 'CLOSED';
}

/**
 * Out of the active portfolio: closed or handed over. These are the statuses
 * the Archive shows and the Projects list hides.
 */
export function isArchivedStatus(status: StatusLike | string | null | undefined): boolean {
  const category = statusCategory(status);
  return category === 'CLOSED' || category === 'HANDOVER';
}

/**
 * Still the EPMO's live workload — the only projects that can be "overdue",
 * since a finished project is late or on time, not overdue.
 */
export function isLiveStatus(status: StatusLike | string | null | undefined): boolean {
  const category = statusCategory(status);
  return category === 'ACTIVE' || category === 'ON_HOLD';
}
