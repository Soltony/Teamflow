
/**
 * @fileoverview This file centralizes the definition of all available permissions in the application.
 * It exports the permissions grouped by category and a flattened list of all permissions.
 */

export const availablePermissions: Record<string, string[]> = {
    'Dashboard': ['dashboard:view'],
    'My Tasks': ['my-tasks:view'],
    'Team View': ['team-view:view', 'team-view:manage', 'team-view:manage-all'],
    'Projects': ['projects:create', 'projects:read', 'projects:read-all', 'projects:update', 'projects:delete', 'timeline:request'],
    'Tasks': ['tasks:approve'],
    'Milestones': ['milestones:view'],
    'Gantt': ['gantt:view'],
    'Timeline Approvals': ['timeline:approve'],
    'PMO Divisions': ['pmo-divisions:view', 'pmo-divisions:create', 'pmo-divisions:update', 'pmo-divisions:delete'],
    'Departments': ['departments:read', 'departments:create', 'departments:update', 'departments:delete'],
    'Teams': ['teams:create', 'teams:read', 'teams:update', 'teams:delete'],
    'Payments': ['payments:view'],
    'Payment Approvals': ['payment-approvals:view', 'payment-approvals:manage'],
    'Reports': ['reports:view'],
    'Settings': ['settings:manage', 'config:manage-users', 'config:manage-roles'],
};

export const allPermissions = Object.values(availablePermissions).flat();

/**
 * Permission required to open each route, checked server-side by the layout
 * guard. Keep this aligned with the sidebar in components/app-shell.tsx:
 * hiding a link is presentation, this is the enforcement.
 *
 * Longest matching prefix wins, so '/projects/[id]/edit' inherits '/projects'.
 * Routes absent from this map require a signed-in user but no specific
 * permission (e.g. /profile).
 */
export const routePermissions: Record<string, string | string[]> = {
  '/dashboard': 'dashboard:view',
  '/today': 'dashboard:view',
  '/weekly-activities': 'dashboard:view',
  '/my-tasks': 'my-tasks:view',
  '/tasks': 'my-tasks:view',
  '/team-view': 'team-view:view',
  /*
   * The consolidated approvals inbox. Any one of the three approval
   * permissions gets you in; the inbox itself then shows only the kinds you
   * hold, so a payments approver never sees a task waiting for review.
   */
  '/approvals': ['tasks:approve', 'timeline:approve', 'payment-approvals:view'],
  /*
   * The three retired queues. Kept in the policy because they still exist as
   * redirects into the inbox — an old bookmark should land somewhere useful,
   * and it must still be gated on the way through.
   */
  '/task-approvals': 'tasks:approve',
  '/projects': 'projects:read',
  '/archive': 'projects:read',
  '/milestones': 'milestones:view',
  '/gantt': 'gantt:view',
  '/pmo-divisions': 'pmo-divisions:view',
  '/departments': 'departments:read',
  '/teams': 'teams:read',
  '/payments': 'payments:view',
  '/payment-approvals': 'payment-approvals:view',
  '/timeline-approvals': 'timeline:approve',
  '/ceo-report': 'reports:view',
  '/reports': 'reports:view',
  '/settings': ['settings:manage', 'config:manage-users', 'config:manage-roles'],
  '/config': ['settings:manage', 'config:manage-users', 'config:manage-roles'],
};

/** Routes reachable without a session. */
export const publicRoutes = ['/login'];

/** Signed-in routes that must stay reachable while a password change is pending. */
export const passwordChangeExemptRoutes = ['/change-password', '/login'];

/**
 * Routes a signed-in user may be sent to that need no specific permission.
 * Kept separate from routePermissions so both lists stay meaningful.
 */
const permissionlessRoutes = ['/profile', '/change-password'];

/**
 * True when the path belongs to a route this application actually serves.
 *
 * Used to decide whether a path is worth remembering as a post-login
 * destination. Without it, any 404 a visitor happens to hit — /admin/login,
 * a scanner probe, a stale bookmark — becomes the place they land after
 * signing in successfully.
 */
export function isKnownAppPath(pathname: string): boolean {
  const routes = [...Object.keys(routePermissions), ...permissionlessRoutes];
  return routes.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

export function permissionForPath(pathname: string): string | string[] | null {
  let best: string | null = null;
  for (const route of Object.keys(routePermissions)) {
    if ((pathname === route || pathname.startsWith(route + '/')) && (!best || route.length > best.length)) {
      best = route;
    }
  }
  return best ? routePermissions[best] : null;
}
