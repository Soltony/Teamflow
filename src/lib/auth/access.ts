import { allPermissions } from '@/lib/permissions';

/**
 * Pure authorization rules: given a user's roles, what may they do?
 *
 * Deliberately free of Prisma, React and `server-only`, so the same logic can
 * be unit tested, used in a server action, and used in a client component to
 * decide what to render. Anything needing a database or a request belongs in
 * guard.ts instead.
 */

export const ADMIN_ROLE_NAME = 'Admin';

/** The shape these rules need — any user-like object with roles. */
export interface RoleBearer {
  roles?: { name: string; permissions?: string[] }[] | null;
}

/**
 * Expands a user's roles into a flat permission set.
 *
 * The Admin role is granted every permission implicitly, which is how it
 * behaved before authentication moved in-house; no role definition needs
 * editing to keep that working.
 */
export function resolvePermissions(user: RoleBearer): Set<string> {
  const granted = new Set<string>();
  for (const role of user.roles ?? []) {
    if (role.name === ADMIN_ROLE_NAME) {
      for (const permission of allPermissions) granted.add(permission);
    } else {
      for (const permission of role.permissions ?? []) granted.add(permission);
    }
  }
  return granted;
}

export function isAdmin(user: RoleBearer): boolean {
  return (user.roles ?? []).some((role) => role.name === ADMIN_ROLE_NAME);
}

/** True when the user holds at least one of the given permissions. */
export function userHasPermission(user: RoleBearer, permission: string | string[]): boolean {
  if (isAdmin(user)) return true;
  const granted = resolvePermissions(user);
  return Array.isArray(permission)
    ? permission.some((p) => granted.has(p))
    : granted.has(permission);
}

/**
 * Whether this user sees the whole portfolio, or only the projects they are
 * attached to.
 *
 * This used to be inferred from holding `projects:read`, `projects:update` and
 * `projects:delete` together — repeated in seven modules. That made
 * portfolio-wide visibility an accident of holding three unrelated rights:
 * granting someone the ability to delete a project silently also let them read
 * every project in the bank. It is now one explicit permission, checked here.
 *
 * The old combination is still honoured so existing roles keep working; it is
 * a compatibility path, not the definition.
 */
export function canSeeAllProjects(user: RoleBearer): boolean {
  if (isAdmin(user)) return true;

  const granted = resolvePermissions(user);
  if (granted.has('projects:read-all')) return true;

  // Legacy: roles created before projects:read-all existed.
  return (
    granted.has('projects:read') &&
    granted.has('projects:update') &&
    granted.has('projects:delete')
  );
}
