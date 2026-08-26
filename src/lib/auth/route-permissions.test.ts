import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  ROUTE_PERMISSIONS,
  SIGNED_IN_ONLY,
  UnknownRouteError,
  ROUTE_TITLES,
  knownRoutes,
  titleForRoute,
  permissionForRoute,
} from './route-permissions';

describe('permissionForRoute', () => {
  it('returns the permission a listed route requires', () => {
    expect(permissionForRoute('/gantt')).toBe('gantt:view');
  });

  it('returns every permission when any one of them will do', () => {
    expect(permissionForRoute('/settings')).toEqual([
      'settings:manage',
      'config:manage-users',
      'config:manage-roles',
    ]);
  });

  it('returns undefined for routes any signed-in user may open', () => {
    // Undefined means "signed in is enough", which is what ProtectedShell reads.
    expect(permissionForRoute('/profile')).toBeUndefined();
  });

  it('throws for a route nobody has decided about', () => {
    // The point of the table: routes are denied by default, so forgetting to
    // add one is a build failure rather than an unprotected page.
    expect(() => permissionForRoute('/payroll')).toThrow(UnknownRouteError);
  });

  it('says how to fix it', () => {
    expect(() => permissionForRoute('/payroll')).toThrow(/route-permissions/);
  });

  it('does not treat a prefix as a match', () => {
    // '/project' is not '/projects'. A loose prefix match here would hand the
    // wrong permission to a route with a similar name.
    expect(() => permissionForRoute('/project')).toThrow(UnknownRouteError);
    expect(() => permissionForRoute('/settings/danger')).toThrow(UnknownRouteError);
  });
});

describe('the policy table', () => {
  it('never lists a route as both open and permission-gated', () => {
    for (const route of SIGNED_IN_ONLY) {
      expect(ROUTE_PERMISSIONS[route], route).toBeUndefined();
    }
  });

  it('gives every entry a non-empty permission', () => {
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
      if (Array.isArray(permission)) expect(permission.length, route).toBeGreaterThan(0);
      else expect(permission.length, route).toBeGreaterThan(0);
    }
  });
});

/**
 * The check that actually prevents the failure this table exists to stop:
 * a page that ships with no authorization decision behind it.
 */
describe('every route in the application', () => {
  const APP = 'src/app';

  /** Top-level route directories that render a page. */
  function routeDirectories(): string[] {
    return readdirSync(APP).filter((entry) => {
      const p = join(APP, entry);
      if (!statSync(p).isDirectory()) return false;
      if (entry === 'api' || entry.startsWith('_')) return false;
      return existsSync(join(p, 'page.tsx')) || existsSync(join(p, 'layout.tsx'));
    });
  }

  it('has an authorization decision recorded for it', () => {
    const missing = routeDirectories()
      .map((d) => `/${d}`)
      .filter((route) => !knownRoutes().includes(route));

    expect(missing, `Routes with no entry in route-permissions.ts: ${missing.join(', ')}`)
      .toEqual([]);
  });

  it('is guarded by a layout', () => {
    // A page directory with no layout renders with no session check at all.
    const unguarded = routeDirectories().filter((d) => !existsSync(join(APP, d, 'layout.tsx')));
    expect(unguarded, `Route directories with no layout.tsx: ${unguarded.join(', ')}`).toEqual([]);
  });

  it('uses the shared factory rather than its own copy of the check', () => {
    // Three routes are deliberately hand-written: login has no shell, and
    // change-password and profile are reachable in states the factory's
    // redirects would fight with.
    const handWritten = ['login', 'change-password', 'profile'];
    const strays = routeDirectories().filter((d) => {
      if (handWritten.includes(d)) return false;
      const layout = join(APP, d, 'layout.tsx');
      return !readFileSync(layout, 'utf8').includes('protectedLayout(');
    });
    expect(strays, `Layouts not using protectedLayout: ${strays.join(', ')}`).toEqual([]);
  });
});

describe('the route titles', () => {
  it('name every route the policy knows about', () => {
    // A route added to one table but not the other renders a tab reading just
    // "NIB EPMO" again, which is the thing this was meant to fix.
    const missing = knownRoutes().filter((route) => !ROUTE_TITLES[route]);
    expect(missing, `Routes with no title: ${missing.join(', ')}`).toEqual([]);
  });

  it('do not name a route that does not exist', () => {
    const extra = Object.keys(ROUTE_TITLES).filter((route) => !knownRoutes().includes(route));
    // /reports and /tasks are drill-down destinations reached from elsewhere;
    // they have titles but no sidebar entry of their own.
    const allowed = new Set(['/reports']);
    const unexpected = extra.filter((r) => !allowed.has(r));
    expect(unexpected, `Titles for unknown routes: ${unexpected.join(', ')}`).toEqual([]);
  });

  it('gives each route a distinct title', () => {
    // Two tabs reading the same thing is the problem restated.
    const titles = Object.values(ROUTE_TITLES);
    const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('titles read as sentence case rather than shouting', () => {
    for (const [route, title] of Object.entries(ROUTE_TITLES)) {
      expect(title, route).not.toBe(title.toUpperCase());
      expect(title.trim(), route).toBe(title);
    }
  });

  it('throws for a route nobody has titled', () => {
    expect(() => titleForRoute('/payroll')).toThrow(UnknownRouteError);
  });
});
