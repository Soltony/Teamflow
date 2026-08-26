import { describe, expect, it } from 'vitest';

import { canSeeAllProjects, isAdmin, resolvePermissions, userHasPermission } from './access';
import { allPermissions } from '@/lib/permissions';

/** A user shaped as the guard functions need to see one. */
const withRoles = (...roles: { name: string; permissions: string[] }[]) =>
  ({ roles } as unknown as Parameters<typeof canSeeAllProjects>[0]);

const role = (name: string, permissions: string[] = []) => ({ name, permissions });

describe('resolvePermissions', () => {
  it('grants an Admin every permission the system defines', () => {
    const granted = resolvePermissions(withRoles(role('Admin')));
    expect(granted.size).toBe(new Set(allPermissions).size);
    for (const p of allPermissions) expect(granted.has(p)).toBe(true);
  });

  it('unions the permissions of several roles', () => {
    const granted = resolvePermissions(
      withRoles(role('A', ['projects:read']), role('B', ['teams:read'])),
    );
    expect([...granted].sort()).toEqual(['projects:read', 'teams:read']);
  });

  it('grants nothing to a user with no roles', () => {
    expect(resolvePermissions(withRoles()).size).toBe(0);
  });
});

describe('userHasPermission', () => {
  it('accepts any one of a list', () => {
    const user = withRoles(role('Lead', ['teams:read']));
    expect(userHasPermission(user, ['settings:manage', 'teams:read'])).toBe(true);
  });

  it('refuses when none of the list is held', () => {
    const user = withRoles(role('Member', ['my-tasks:view']));
    expect(userHasPermission(user, ['settings:manage', 'config:manage-roles'])).toBe(false);
  });

  it('lets an Admin through regardless', () => {
    expect(userHasPermission(withRoles(role('Admin')), 'anything:at-all')).toBe(true);
  });
});

describe('canSeeAllProjects', () => {
  it('is true for an Admin', () => {
    expect(canSeeAllProjects(withRoles(role('Admin')))).toBe(true);
    expect(isAdmin(withRoles(role('Admin')))).toBe(true);
  });

  it('is true when the explicit permission is held', () => {
    expect(canSeeAllProjects(withRoles(role('Director', ['projects:read-all'])))).toBe(true);
  });

  it('needs only the explicit permission, not delete rights as well', () => {
    // The point of the change: portfolio-wide visibility can now be granted
    // without also handing out the ability to delete projects.
    const viewer = withRoles(role('Portfolio Viewer', ['projects:read', 'projects:read-all']));
    expect(canSeeAllProjects(viewer)).toBe(true);
    expect(userHasPermission(viewer, 'projects:delete')).toBe(false);
  });

  it('still honours the old read+update+delete combination', () => {
    // Existing roles keep working; this is the compatibility path.
    const legacy = withRoles(
      role('Legacy Manager', ['projects:read', 'projects:update', 'projects:delete']),
    );
    expect(canSeeAllProjects(legacy)).toBe(true);
  });

  it('is false for someone holding only part of the old combination', () => {
    expect(
      canSeeAllProjects(withRoles(role('PM', ['projects:read', 'projects:update']))),
    ).toBe(false);
  });

  it('is false for an ordinary member', () => {
    expect(canSeeAllProjects(withRoles(role('Member', ['projects:read'])))).toBe(false);
  });

  it('is false for a user with no roles', () => {
    expect(canSeeAllProjects(withRoles())).toBe(false);
  });

  it('unions across roles, so the combination may be spread over two', () => {
    const split = withRoles(
      role('A', ['projects:read', 'projects:update']),
      role('B', ['projects:delete']),
    );
    expect(canSeeAllProjects(split)).toBe(true);
  });
});
