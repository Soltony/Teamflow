
<<<<<<< HEAD
/**
 * @fileoverview This file centralizes the definition of all available permissions in the application.
 * It exports the permissions grouped by category and a flattened list of all permissions.
 */

export const availablePermissions: Record<string, string[]> = {
    'Dashboard': ['dashboard:view'],
    'My Tasks': ['my-tasks:view'],
    'Team View': ['team-view:view', 'team-view:manage'],
    'Projects': ['projects:create', 'projects:read', 'projects:update', 'projects:delete'],
    'Milestones': ['milestones:view'],
    'Gantt': ['gantt:view'],
    'Departments': ['departments:create', 'departments:read', 'departments:update', 'departments:delete'],
    'Teams': ['teams:create', 'teams:read', 'teams:update', 'teams:delete'],
    'Settings': ['settings:manage'],
    'Configuration': ['config:manage-users', 'config:manage-roles'],
};

export const allPermissions = Object.values(availablePermissions).flat();
=======
export const ALL_PERMISSIONS = [
  'dashboard:view',
  'my-tasks:view',
  'team-view:view',
  'team-view:manage',
  'projects:create',
  'projects:read',
  'projects:update',
  'projects:delete',
  'milestones:view',
  'gantt:view',
  'departments:create',
  'departments:read',
  'departments:update',
  'departments:delete',
  'teams:create',
  'teams:read',
  'teams:update',
  'teams:delete',
  'settings:manage',
  'config:manage-users',
  'config:manage-roles',
];
>>>>>>> 61e8ccf03e1840dffa9fd2636cd282847d43defd
