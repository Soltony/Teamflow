import type { LucideIcon } from 'lucide-react';
import {
  AreaChart,
  Archive,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DollarSign,
  FolderKanban,
  GanttChartSquare,
  Home,
  Library,
  ListTodo,
  Milestone,
  Settings,
  ThumbsUp,
  UsersRound,
} from 'lucide-react';

/**
 * The sidebar's contents.
 *
 * Eighteen items were listed flat, in no particular order, so finding anything
 * meant reading the whole list — and an administrator, who can see all of them,
 * had the worst of it. They are grouped by what somebody is trying to do.
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
   * `/reports` is a drill-down reached from the dashboard's stat cards. It has
   * no sidebar entry of its own, so landing there used to leave nothing
   * selected and no clue where you were.
   */
  alsoActiveOn?: string[];
  /** For items whose href is a prefix of unrelated routes. */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'My work',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: Home, permission: 'dashboard:view', exact: true },
      { href: '/today', label: 'Today', icon: ListTodo, permission: 'dashboard:view' },
      { href: '/weekly-activities', label: 'This week', icon: CalendarDays, permission: 'dashboard:view' },
      { href: '/my-tasks', label: 'My tasks', icon: ClipboardCheck, permission: 'my-tasks:view' },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderKanban, permission: 'projects:read' },
      { href: '/milestones', label: 'Milestones', icon: Milestone, permission: 'milestones:view' },
      { href: '/gantt', label: 'Timeline', icon: GanttChartSquare, permission: 'gantt:view' },
      { href: '/archive', label: 'Archive', icon: Archive, permission: 'projects:read' },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/team-view', label: 'Team view', icon: ClipboardList, permission: 'team-view:view' },
      { href: '/teams', label: 'Teams', icon: UsersRound, permission: 'teams:read' },
    ],
  },
  {
    label: 'Awaiting approval',
    items: [
      { href: '/task-approvals', label: 'Tasks', icon: ThumbsUp, permission: 'tasks:approve' },
      { href: '/timeline-approvals', label: 'Timeline changes', icon: Clock, permission: 'timeline:approve' },
      { href: '/payment-approvals', label: 'Payments', icon: CheckSquare, permission: 'payment-approvals:view' },
    ],
  },
  {
    label: 'Money and reporting',
    items: [
      { href: '/payments', label: 'Payments', icon: DollarSign, permission: 'payments:view' },
      {
        href: '/ceo-report',
        label: 'Portfolio report',
        icon: AreaChart,
        permission: 'reports:view',
        alsoActiveOn: ['/reports'],
      },
    ],
  },
  {
    label: 'Organisation',
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
 * every route beneath it, and /reports would light nothing at all.
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
