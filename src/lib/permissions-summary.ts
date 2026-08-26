import { availablePermissions } from './permissions';

/**
 * Describing a role's permissions in words.
 *
 * The role list printed the raw strings — `projects:read, projects:update,
 * projects:read-all, timeline:request, tasks:approve, …` — which is thirty-four
 * possible tokens run together and nobody reads it. Grouping them by the same
 * headings the editor uses gives a summary somebody can actually check against
 * what they meant to grant.
 *
 * Pure, so the summarising can be tested without rendering anything.
 */

/** Which group each permission belongs to, from the single registry. */
const GROUP_OF = new Map<string, string>();
for (const [group, permissions] of Object.entries(availablePermissions)) {
  for (const permission of permissions) GROUP_OF.set(permission, group);
}

export interface PermissionGroupSummary {
  group: string;
  granted: number;
  total: number;
  /** Every permission in the group is granted. */
  complete: boolean;
}

/**
 * A per-group tally of what a role grants.
 *
 * Groups with nothing granted are left out: a summary should say what a role
 * can do, not list the fourteen things it cannot.
 */
export function summarisePermissions(granted: string[]): PermissionGroupSummary[] {
  const counts = new Map<string, number>();
  for (const permission of granted) {
    const group = GROUP_OF.get(permission);
    // A permission that no longer exists in the registry is ignored rather
    // than shown as an unnamed group.
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  return Object.entries(availablePermissions)
    .map(([group, permissions]) => ({
      group,
      granted: counts.get(group) ?? 0,
      total: permissions.length,
      complete: (counts.get(group) ?? 0) === permissions.length,
    }))
    .filter((s) => s.granted > 0);
}

/** A one-line description, for a list where a full breakdown would not fit. */
export function describePermissions(granted: string[]): string {
  if (granted.length === 0) return 'No permissions';

  const summary = summarisePermissions(granted);
  if (summary.length === 0) return 'No permissions';

  const full = summary.filter((s) => s.complete).map((s) => s.group);
  const partial = summary.filter((s) => !s.complete);

  const parts: string[] = [];
  if (full.length) parts.push(`Full access to ${list(full)}`);
  for (const p of partial) parts.push(`${p.granted} of ${p.total} in ${p.group}`);
  return parts.join('; ');
}

/** Counts any permission the registry no longer declares. */
export function unknownPermissions(granted: string[]): string[] {
  return granted.filter((p) => !GROUP_OF.has(p));
}

function list(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
