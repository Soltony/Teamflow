import type { LucideIcon } from 'lucide-react';
import {
  AreaChart,
  Archive,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FolderKanban,
  GanttChartSquare,
  Home,
  Inbox,
  Library,
  ListTodo,
  Milestone,
  Settings,
  UsersRound,
  Wallet,
} from 'lucide-react';

/**
 * The sidebar's contents.
 *
 * Grouped by the question somebody is answering when they look at it:
 *
 *  - **Work** — what am I doing today?
 *  - **Delivery** — how are the projects themselves going?
 *  - **Governance** — what needs a decision, and where is the money?
 *  - **Insight** — what do I tell the executive?
 *  - **Administration** — how is the system set up?
 *
 * Two consolidations are visible here. The three approval queues — tasks,
 * deadline changes, payments — are one **Approvals** inbox: they were three
 * pages that each said nothing about the other two, so "what is waiting on me"
 * could not be answered without visiting all three. And the two reporting
 * pages, `/ceo-report` and `/reports`, are one **Reports** experience: they
 * had the same permission and overlapping figures, and the drill-down links
 * pointed between them.
 *
 * Kept out of the component so the grouping and the active-route rules can be
 * tested without rendering a sidebar.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omit for items everyone may see. */
  permission?: string | string[];
  /**
   * Extra paths that should light this item up.
   *
   * Used for the routes that were consolidated: somebody following an old
   * `/task-approvals` bookmark still lands on a lit-up Approvals entry.
   */
  alsoActiveOn?: string[];
  /** For items whose href is a prefix of unrelated routes. */
  exact?: boolean;
  /**
   * Which live counter to show beside the label, if any.
   *
   * The count itself is fetched by the shell, not declared here — this only
   * says which item is entitled to one.
   */
  badge?: 'approvals';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Every permission that lets somebody into some part of the approvals inbox. */
export const APPROVAL_PERMISSIONS = [
  'tasks:approve',
  'timeline:approve',
  'payment-approvals:view',
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: Home, permission: 'dashboard:view', exact: true },
      { href: '/today', label: 'Today', icon: ListTodo, permission: 'dashboard:view' },
      { href: '/weekly-activities', label: 'This week', icon: CalendarDays, permission: 'dashboard:view' },
      { href: '/my-tasks', label: 'My tasks', icon: ClipboardCheck, permission: 'my-tasks:view' },
      { href: '/team-view', label: 'Team view', icon: ClipboardList, permission: 'team-view:view' },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderKanban, permission: 'projects:read' },
      { href: '/milestones', label: 'Milestones', icon: Milestone, permission: 'milestones:view' },
      { href: '/gantt', label: 'Schedule', icon: GanttChartSquare, permission: 'gantt:view' },
      { href: '/teams', label: 'Teams', icon: UsersRound, permission: 'teams:read' },
      { href: '/archive', label: 'Archive', icon: Archive, permission: 'projects:read' },
    ],
  },
  {
    label: 'Governance',
    items: [
      {
        href: '/approvals',
        label: 'Approvals',
        icon: Inbox,
        permission: APPROVAL_PERMISSIONS,
        badge: 'approvals',
        // The three retired queues keep working and keep this entry lit.
        alsoActiveOn: ['/task-approvals', '/timeline-approvals', '/payment-approvals'],
      },
      { href: '/payments', label: 'Payments', icon: Wallet, permission: 'payments:view' },
    ],
  },
  {
    label: 'Insight',
    items: [
      {
        href: '/reports',
        label: 'Reports',
        icon: AreaChart,
        permission: 'reports:view',
        // `/ceo-report` folded into this one.
        alsoActiveOn: ['/ceo-report'],
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/pmo-divisions', label: 'EPMO divisions', icon: Library, permission: 'pmo-divisions:view' },
      { href: '/departments', label: 'Departments', icon: Building2, permission: 'departments:read' },
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        permission: ['settings:manage', 'config:manage-users', 'config:manage-roles'],
      },
    ],
  },
];

/**
 * Whether a nav item should appear selected for the current path.
 *
 * `startsWith` alone is wrong in both directions: /dashboard would stay lit on
 * every route beneath it, and a consolidated route would light nothing at all
 * when reached by one of its old addresses.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const matches = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`) || pathname.startsWith(`${base}?`);

  if (item.exact ? pathname === item.href : matches(item.href)) return true;
  return (item.alsoActiveOn ?? []).some(matches);
}

/**
 * The groups a particular person can actually use.
 *
 * A group whose every item is hidden by permission is dropped entirely — a
 * heading with nothing under it reads as a broken screen, and someone with only
 * task permissions would otherwise see four empty section titles.
 */
export function visibleGroups(
  groups: NavGroup[],
  hasPermission: (permission: string | string[]) => boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}
