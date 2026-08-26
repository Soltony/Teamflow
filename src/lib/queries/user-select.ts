/**
 * What a user query may send to the browser.
 *
 * Several actions loaded users with `include: { roles: ... }` and no `select`,
 * which returns the whole row — `passwordHash`, `failedLoginAttempts`,
 * `lockedUntil` and the rest — and then serialised all of it into the page so a
 * dropdown could show a name. None of it was rendered; all of it was readable
 * in the browser.
 *
 * These selectors are the allow-list. Adding a column here is a deliberate act,
 * which is the point: the default should never be "everything".
 */

/** Everything needed to show a person and check what they may do. */
export const USER_WITH_ROLES_SELECT = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
  phoneNumber: true,
  pmoDivisionId: true,
  roles: {
    select: { id: true, name: true, description: true, permissions: true },
  },
} as const;

/** Just enough to render an avatar or an assignee chip. */
export const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

/**
 * A person as any screen needs to display them.
 *
 * Wider than USER_SUMMARY_SELECT because assignee lists, task authors and
 * project managers are rendered with a division or a phone number in places.
 * It is still an allow-list: `passwordHash`, `failedLoginAttempts`,
 * `lockedUntil` and `passwordChangedAt` are absent, and relations that used a
 * bare `include: { assignees: true }` were sending all four to the browser.
 */
export const USER_DISPLAY_SELECT = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
  phoneNumber: true,
  pmoDivisionId: true,
  isActive: true,
} as const;
