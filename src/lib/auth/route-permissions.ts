/**
 * Which permission each route requires.
 *
 * This table is the authorization policy for the application, in one place that
 * can be read top to bottom and audited. It used to be spread across twenty-one
 * near-identical `layout.tsx` files that differed only in a string, which had
 * two costs: nobody could see the policy as a whole, and the design failed open
 * — a new route directory with no layout was simply unprotected, and nothing
 * would have said so.
 *
 * `permissionForRoute` fails closed instead: a route absent from this table
 * throws rather than rendering. Adding a page therefore forces a deliberate
 * decision about who may see it.
 *
 * Pure, with no Prisma or React imports, so the policy can be tested directly.
 */

/**
 * Routes that any signed-in user may open.
 *
 * Distinct from "not listed": these are a deliberate decision, not an omission.
 */
export const SIGNED_IN_ONLY = [
  '/change-password',
  '/login',
  '/profile',
] as const;

export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  '/archive': 'projects:read',
  '/ceo-report': 'reports:view',
  '/config': ['settings:manage', 'config:manage-users', 'config:manage-roles'],
  '/dashboard': 'dashboard:view',
  '/departments': 'departments:read',
  '/gantt': 'gantt:view',
  '/milestones': 'milestones:view',
  '/my-tasks': 'my-tasks:view',
  '/payment-approvals': 'payment-approvals:view',
  '/payments': 'payments:view',
  '/pmo-divisions': 'pmo-divisions:view',
  '/projects': 'projects:read',
  '/reports': 'reports:view',
  '/settings': ['settings:manage', 'config:manage-users', 'config:manage-roles'],
  '/task-approvals': 'tasks:approve',
  '/tasks': 'my-tasks:view',
  '/team-view': 'team-view:view',
  '/teams': 'teams:read',
  '/timeline-approvals': 'timeline:approve',
  '/today': 'dashboard:view',
  '/weekly-activities': 'dashboard:view',
};

/** Every route this table knows about, protected or explicitly open. */
export function knownRoutes(): string[] {
  return [...Object.keys(ROUTE_PERMISSIONS), ...SIGNED_IN_ONLY].sort();
}

export class UnknownRouteError extends Error {
  constructor(route: string) {
    super(
      `No authorization policy for "${route}". Add it to ROUTE_PERMISSIONS in ` +
        'src/lib/auth/route-permissions.ts, or to SIGNED_IN_ONLY if any signed-in ' +
        'user may open it. Routes are denied by default.',
    );
    this.name = 'UnknownRouteError';
  }
}

/**
 * The permission a route requires.
 *
 * Returns `undefined` for routes any signed-in user may open — which the caller
 * passes straight to ProtectedShell, where an absent permission means exactly
 * that. Throws for a route nobody has made a decision about.
 */
export function permissionForRoute(route: string): string | string[] | undefined {
  if ((SIGNED_IN_ONLY as readonly string[]).includes(route)) return undefined;
  const permission = ROUTE_PERMISSIONS[route];
  if (permission === undefined) throw new UnknownRouteError(route);
  return permission;
}

/**
 * What each route calls itself in a browser tab.
 *
 * The root layout has always declared a `"%s | NIB EPMO"` title template, but
 * nothing supplied the %s, so all twenty-eight routes rendered as plain
 * "NIB EPMO". Anyone keeping a project, an approval queue and the dashboard
 * open at once had three identical tabs.
 *
 * Kept beside the permission table because both are per-route facts about the
 * same list, and a route added to one but not the other is a mistake worth a
 * failing test.
 */
export const ROUTE_TITLES: Record<string, string> = {
  '/archive': 'Archive',
  '/ceo-report': 'Portfolio report',
  '/change-password': 'Change password',
  '/config': 'Configuration',
  '/dashboard': 'Dashboard',
  '/departments': 'Departments',
  '/gantt': 'Timeline',
  '/login': 'Sign in',
  '/milestones': 'Milestones',
  '/my-tasks': 'My tasks',
  '/payment-approvals': 'Payment approvals',
  '/payments': 'Payments',
  '/pmo-divisions': 'EPMO divisions',
  '/profile': 'Profile',
  '/projects': 'Projects',
  '/reports': 'Report',
  '/settings': 'Settings',
  '/task-approvals': 'Task approvals',
  '/tasks': 'Task',
  '/team-view': 'Team view',
  '/teams': 'Teams',
  '/timeline-approvals': 'Timeline approvals',
  '/today': 'Today',
  '/weekly-activities': 'This week',
};

/** The title for a route, for use in a layout's exported metadata. */
export function titleForRoute(route: string): string {
  const title = ROUTE_TITLES[route];
  if (!title) throw new UnknownRouteError(route);
  return title;
}
