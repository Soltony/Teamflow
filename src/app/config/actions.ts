/**
 * /config and /settings were two copies of the same user- and role-management
 * module, each with its own createUser/updateUser/deleteRole implementation.
 * During the authentication migration they were collapsed onto the single
 * secured implementation in app/settings/actions.ts so a permission check
 * cannot be fixed in one copy and missed in the other.
 *
 * This file re-exports that implementation, so components importing from
 * '@/app/config/actions' keep working unchanged. It deliberately carries no
 * 'use server' directive of its own: such a file may only export async
 * function declarations, and the actions below are already server actions by
 * virtue of the directive in the module they come from.
 */

export {
  getUsersData,
  getRolesData,
  getPmoDivisionsData,
  createUser,
  updateUser,
  deleteUser,
  setUserActive,
  resetUserPassword,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
} from '@/app/settings/actions';
