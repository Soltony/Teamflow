import { describe, expect, it } from 'vitest';

import {
  allPermissions,
  availablePermissions,
  isKnownAppPath,
  permissionForPath,
  publicRoutes,
  routePermissions,
} from './permissions';

describe('permission catalogue', () => {
  it('has no duplicates across groups', () => {
    expect(new Set(allPermissions).size).toBe(allPermissions.length);
  });

  it('names every permission as module:action', () => {
    for (const permission of allPermissions) {
      expect(permission, permission).toMatch(/^[a-z-]+:[a-z-]+$/);
    }
  });

  it('exposes every grouped permission in the flat list', () => {
    const grouped = Object.values(availablePermissions).flat();
    expect([...grouped].sort()).toEqual([...allPermissions].sort());
  });
});

describe('routePermissions', () => {
  it('only requires permissions the system actually defines', () => {
    const known = new Set(allPermissions);
    for (const [route, permission] of Object.entries(routePermissions)) {
      for (const p of Array.isArray(permission) ? permission : [permission]) {
        expect(known.has(p), `${route} requires unknown permission "${p}"`).toBe(true);
      }
    }
  });

  it('uses absolute paths', () => {
    for (const route of Object.keys(routePermissions)) {
      expect(route, route).toMatch(/^\//);
    }
  });

  it('does not gate a public route', () => {
    for (const route of publicRoutes) {
      expect(routePermissions[route]).toBeUndefined();
    }
  });
});

describe('permissionForPath', () => {
  it('resolves an exact route', () => {
    expect(permissionForPath('/dashboard')).toBe('dashboard:view');
  });

  it('inherits the parent route for a nested path', () => {
    expect(permissionForPath('/projects/abc123')).toBe('projects:read');
    expect(permissionForPath('/projects/abc123/edit')).toBe('projects:read');
  });

  it('prefers the longest matching prefix', () => {
    // /payment-approvals must not be served by the /payments entry.
    expect(permissionForPath('/payment-approvals')).toBe('payment-approvals:view');
    expect(permissionForPath('/payments')).toBe('payments:view');
  });

  it('returns null for a route with no permission requirement', () => {
    expect(permissionForPath('/profile')).toBeNull();
    expect(permissionForPath('/nonsense')).toBeNull();
  });

  it('does not treat a route name as a prefix of an unrelated longer name', () => {
    // '/teams' must not match '/team-view'.
    expect(permissionForPath('/team-view')).toBe('team-view:view');
  });
});

describe('isKnownAppPath', () => {
  it('accepts routes the application serves', () => {
    expect(isKnownAppPath('/dashboard')).toBe(true);
    expect(isKnownAppPath('/projects')).toBe(true);
    expect(isKnownAppPath('/projects/abc/edit')).toBe(true);
    expect(isKnownAppPath('/profile')).toBe(true);
    expect(isKnownAppPath('/change-password')).toBe(true);
  });

  it('rejects paths that would 404, so they cannot become a post-login target', () => {
    // The exact probe seen in the server log.
    expect(isKnownAppPath('/admin/login')).toBe(false);
    expect(isKnownAppPath('/wp-admin')).toBe(false);
    expect(isKnownAppPath('/manifest.webmanifest')).toBe(false);
    expect(isKnownAppPath('/')).toBe(false);
  });

  it('does not accept a path that merely starts with a route name', () => {
    expect(isKnownAppPath('/projectsomething')).toBe(false);
  });
});
