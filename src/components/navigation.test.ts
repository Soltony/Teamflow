import { describe, expect, it } from 'vitest';

import { NAV_GROUPS, isNavItemActive, visibleGroups, type NavItem } from './navigation';
import { knownRoutes } from '@/lib/auth/route-permissions';

const item = (over: Partial<NavItem> = {}): NavItem => ({
  href: '/projects',
  label: 'Projects',
  icon: (() => null) as unknown as NavItem['icon'],
  ...over,
});

describe('isNavItemActive', () => {
  it('lights up on its own route', () => {
    expect(isNavItemActive(item(), '/projects')).toBe(true);
  });

  it('stays lit on a route beneath it', () => {
    // Opening a project should not deselect Projects in the sidebar.
    expect(isNavItemActive(item(), '/projects/abc123')).toBe(true);
    expect(isNavItemActive(item(), '/projects/abc123/milestones')).toBe(true);
  });

  it('does not light up on a route that merely shares its prefix', () => {
    // The bug a bare startsWith would cause: /projects matching /projects-archive.
    expect(isNavItemActive(item(), '/projects-archive')).toBe(false);
    expect(isNavItemActive(item({ href: '/payments' }), '/payment-approvals')).toBe(false);
    expect(isNavItemActive(item({ href: '/teams' }), '/team-view')).toBe(false);
    expect(isNavItemActive(item({ href: '/tasks' }), '/task-approvals')).toBe(false);
  });

  it('honours an exact match for the dashboard', () => {
    const dashboard = item({ href: '/dashboard', exact: true });
    expect(isNavItemActive(dashboard, '/dashboard')).toBe(true);
    expect(isNavItemActive(dashboard, '/dashboard/anything')).toBe(false);
  });

  it('lights the portfolio report on its drill-down pages', () => {
    // /reports is reached from the dashboard stat cards and has no sidebar
    // entry of its own; without this, landing there selected nothing at all.
    const report = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === '/ceo-report')!;
    expect(isNavItemActive(report, '/reports')).toBe(true);
    expect(isNavItemActive(report, '/reports?type=overdue')).toBe(true);
    expect(isNavItemActive(report, '/ceo-report')).toBe(true);
  });

  it('selects exactly one item for any route in the sidebar', () => {
    // Two lit items is as disorienting as none.
    const all = NAV_GROUPS.flatMap((g) => g.items);
    for (const target of all) {
      const lit = all.filter((i) => isNavItemActive(i, target.href));
      expect(lit.map((i) => i.href), `on ${target.href}`).toEqual([target.href]);
    }
  });
});

describe('visibleGroups', () => {
  it('hides an item the person may not open', () => {
    const groups = visibleGroups(NAV_GROUPS, (p) => p === 'my-tasks:view');
    const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual(['/my-tasks']);
  });

  it('drops a heading with nothing left under it', () => {
    // A section title with no items reads as a broken screen.
    const groups = visibleGroups(NAV_GROUPS, (p) => p === 'my-tasks:view');
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('My work');
  });

  it('shows everything to somebody who may see everything', () => {
    const groups = visibleGroups(NAV_GROUPS, () => true);
    expect(groups).toHaveLength(NAV_GROUPS.length);
    expect(groups.flatMap((g) => g.items)).toHaveLength(
      NAV_GROUPS.flatMap((g) => g.items).length,
    );
  });

  it('shows nothing to somebody with no permissions at all', () => {
    expect(visibleGroups(NAV_GROUPS, () => false)).toEqual([]);
  });

  it('accepts an item that needs any one of several permissions', () => {
    const groups = visibleGroups(NAV_GROUPS, (p) =>
      Array.isArray(p) ? p.includes('config:manage-users') : false,
    );
    expect(groups.flatMap((g) => g.items.map((i) => i.href))).toContain('/settings');
  });
});

describe('the sidebar and the authorization policy agree', () => {
  it('never links to a route with no policy behind it', () => {
    // A link to a route absent from route-permissions.ts would throw when
    // opened, because routes are denied by default.
    const linked = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    const unknown = linked.filter((href) => !knownRoutes().includes(href));
    expect(unknown, `Sidebar links with no policy: ${unknown.join(', ')}`).toEqual([]);
  });

  it('does not link to the same route twice', () => {
    const linked = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(linked).size).toBe(linked.length);
  });

  it('gives every item a label and an icon', () => {
    for (const i of NAV_GROUPS.flatMap((g) => g.items)) {
      expect(i.label.length, i.href).toBeGreaterThan(0);
      expect(i.icon, i.href).toBeTruthy();
    }
  });
});
