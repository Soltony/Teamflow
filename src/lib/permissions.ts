
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
    'PMO Divisions': ['responsible-depts:view'],
    'Departments': ['departments:read', 'departments:create', 'departments:update', 'departments:delete'],
    'Teams': ['teams:create', 'teams:read', 'teams:update', 'teams:delete'],
    'Reports': ['reports:view'],
    'Settings': ['settings:manage'],
    'Configuration': ['config:manage-users', 'config:manage-roles'],
};

export const allPermissions = Object.values(availablePermissions).flat();
