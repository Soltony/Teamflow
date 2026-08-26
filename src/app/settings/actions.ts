'use server';

import { revalidatePath } from 'next/cache';

import prisma from '@/lib/db';
import { getNumber } from '@/lib/settings';
import { permit, requirePermission, ADMIN_ROLE_NAME } from '@/lib/auth/guard';
import { auditAction } from '@/lib/auth/audit-context';
import { AUDIT_ACTIONS } from '@/lib/audit-log';
import { normalizePhoneNumber } from '@/lib/auth/phone';
import {
  generateTemporaryPassword,
  hashPassword,
  validatePasswordStrength,
} from '@/lib/auth/password';
import { revokeAllSessionsForUser } from '@/lib/auth/session';
import { allPermissions } from '@/lib/permissions';
import { serialize } from '@/lib/serialize';

/**
 * Settings: project statuses, the active working year, users, and roles.
 *
 * User accounts are created and maintained entirely here. Nothing in this file
 * contacts an external identity service any more.
 */

/** `Result` carries no extra data; `Result<{ x: string }>` adds `x` on success. */
type Result<T extends object = Record<never, never>> =
  | ({ success: true } & T)
  | { success: false; error: string };

async function audit(
  type: 'PASSWORD_RESET' | 'ACCOUNT_ENABLED' | 'ACCOUNT_DISABLED' | 'SESSIONS_REVOKED',
  opts: { actorId: string; targetUserId?: string; detail?: string },
) {
  await prisma.authEvent
    .create({
      data: {
        type,
        userId: opts.targetUserId ?? opts.actorId,
        subject: opts.targetUserId ?? null,
        detail: `${opts.detail ?? type} (by ${opts.actorId})`,
      },
    })
    .catch(() => undefined);
}

const SETTINGS_PERMISSIONS = ['settings:manage', 'config:manage-users', 'config:manage-roles'];

// ---------------------------------------------------------------- page data

export async function getSettingsPageData() {
  await requirePermission(SETTINGS_PERMISSIONS);

  const [projectStatuses, projects, activeYearSetting, users, roles, pmoDivisions] =
    await Promise.all([
      prisma.projectStatus.findMany({ orderBy: { name: 'asc' } }),
      prisma.project.findMany({
        select: { workingYear: true },
        distinct: ['workingYear'],
        orderBy: { workingYear: 'desc' },
      }),
      prisma.setting.findUnique({ where: { key: 'activeWorkingYear' } }),
      prisma.user.findMany({
        // Never send password material to the browser.
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          phoneNumber: true,
          pmoDivisionId: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          lockedUntil: true,
          createdAt: true,
          updatedAt: true,
          roles: true,
        },
        orderBy: { name: 'asc' },
      }),
      // The count answers "what does changing this affect?", which the
      // role list could not previously say.
      prisma.role.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { users: true } } },
      }),
      prisma.pmoDivision.findMany({ orderBy: { name: 'asc' } }),
    ]);

  return {
    projectStatuses: serialize(projectStatuses),
    projects: serialize(projects),
    activeYearSetting: serialize(activeYearSetting),
    users: serialize(users),
    roles: serialize(roles),
    pmoDivisions: serialize(pmoDivisions),
  };
}

export async function getUsersData() {
  await requirePermission('config:manage-users');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
      phoneNumber: true,
      pmoDivisionId: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      roles: true,
    },
    orderBy: { name: 'asc' },
  });
  return serialize(users);
}

export async function getRolesData() {
  await requirePermission(SETTINGS_PERMISSIONS);
  return serialize(
    await prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    }),
  );
}

export async function getPmoDivisionsData() {
  await requirePermission(SETTINGS_PERMISSIONS);
  return serialize(await prisma.pmoDivision.findMany({ orderBy: { name: 'asc' } }));
}

// --------------------------------------------------------- project statuses

export async function createProjectStatus(name: string): Promise<Result> {
  const guard = await permit('settings:manage');
  if (!guard.ok) return guard.denied;
  if (!name || name.trim().length < 3) {
    return { success: false, error: 'Status name must be at least 3 characters.' };
  }
  try {
    await prisma.projectStatus.create({ data: { name: name.trim() } });
    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to create status. It may already exist.' };
  }
}

export async function updateProjectStatus(id: string, name: string): Promise<Result> {
  const guard = await permit('settings:manage');
  if (!guard.ok) return guard.denied;
  if (!name || name.trim().length < 3) {
    return { success: false, error: 'Status name must be at least 3 characters.' };
  }
  try {
    await prisma.projectStatus.update({ where: { id }, data: { name: name.trim() } });
    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update status.' };
  }
}

export async function deleteProjectStatus(id: string): Promise<Result> {
  const guard = await permit('settings:manage');
  if (!guard.ok) return guard.denied;
  try {
    const inUse = await prisma.project.count({ where: { statusId: id } });
    if (inUse > 0) {
      return { success: false, error: 'Cannot delete status as it is currently in use by projects.' };
    }
    await prisma.projectStatus.delete({ where: { id } });
    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete status.' };
  }
}

// ------------------------------------------------------------ general settings

export async function updateActiveWorkingYear(year: string): Promise<Result> {
  const guard = await permit('settings:manage');
  if (!guard.ok) return guard.denied;
  try {
    await prisma.setting.upsert({
      where: { key: 'activeWorkingYear' },
      update: { value: year },
      create: { key: 'activeWorkingYear', value: year },
    });
    await auditAction(guard.user, {
      action: AUDIT_ACTIONS.SETTING_UPDATED,
      entity: 'Setting',
      entityId: 'activeWorkingYear',
      details: { value: year },
    });
    revalidatePath('/settings');
    revalidatePath('/dashboard');
    revalidatePath('/projects/new');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update active working year.' };
  }
}

// ------------------------------------------------------------- user accounts

interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  roleIds: string[];
  pmoDivisionId?: string;
  password?: string;
}

function validateUserInput(data: UserInput): string | null {
  if (!data?.firstName?.trim() || !data?.lastName?.trim()) return 'First and last name are required.';
  const email = data.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  if (!normalizePhoneNumber(data.phoneNumber)) {
    return 'Enter a valid Ethiopian phone number, for example 0912345678.';
  }
  return null;
}

/**
 * Creates a user account in this system.
 *
 * Returns a generated temporary password once, for the administrator to hand
 * over. It is stored only as a hash, and the account must change it on first
 * sign-in. Replaces the previous flow, which registered against an external
 * service using the shared password "Welcome2PMO".
 */
export async function createUser(
  data: UserInput,
): Promise<Result<{ temporaryPassword: string }>> {
  const guard = await permit('config:manage-users');
  if (!guard.ok) return guard.denied;
  const actor = guard.user;

  const invalid = validateUserInput(data);
  if (invalid) return { success: false, error: invalid };

  const email = data.email.trim().toLowerCase();
  const phoneNumber = normalizePhoneNumber(data.phoneNumber)!;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phoneNumber }] },
    select: { email: true },
  });
  if (existing) {
    return {
      success: false,
      error: 'An account with that email address or phone number already exists.',
    };
  }

  const pending = await prisma.pendingUser.findFirst({
    where: { OR: [{ email }, { phoneNumber }] },
    select: { id: true },
  });
  if (pending) {
    return {
      success: false,
      error:
        'This person already has a migrated account awaiting their first sign-in. They can sign in with their existing password.',
    };
  }

  // An administrator may supply a password; otherwise one is generated.
  let temporaryPassword = data.password?.trim() || '';
  if (temporaryPassword) {
    const policyError = validatePasswordStrength(temporaryPassword, await getNumber('security.passwordMinLength'));
    if (policyError) return { success: false, error: policyError };
  } else {
    temporaryPassword = generateTemporaryPassword();
  }

  try {
    await prisma.user.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        name: `${data.firstName.trim()} ${data.lastName.trim()}`,
        email,
        phoneNumber,
        pmoDivisionId: data.pmoDivisionId || null,
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        roles: { connect: (data.roleIds ?? []).map((id) => ({ id })) },
      },
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    return { success: false, error: 'Failed to create the user account.' };
  }

  await audit('ACCOUNT_ENABLED', { actorId: actor.id, detail: `Created account ${email}` });
  await auditAction(actor, {
    action: AUDIT_ACTIONS.USER_CREATED,
    entity: 'User',
    entityId: email,
    // The generated password is deliberately not passed; sanitizeDetails would
    // redact it anyway, but it should never reach the call either.
    details: {
      email,
      phoneNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      roleIds: data.roleIds ?? [],
      pmoDivisionId: data.pmoDivisionId || null,
    },
  });
  revalidatePath('/settings');
  revalidatePath('/config');
  return { success: true, temporaryPassword };
}

export async function updateUser(userId: string, data: UserInput): Promise<Result> {
  const guard = await permit('config:manage-users');
  if (!guard.ok) return guard.denied;
  const actor = guard.user;

  const invalid = validateUserInput(data);
  if (invalid) return { success: false, error: invalid };

  const email = data.email.trim().toLowerCase();
  const phoneNumber = normalizePhoneNumber(data.phoneNumber)!;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });
  if (!target) return { success: false, error: 'User not found.' };

  const clash = await prisma.user.findFirst({
    where: { id: { not: userId }, OR: [{ email }, { phoneNumber }] },
    select: { id: true },
  });
  if (clash) {
    return { success: false, error: 'That email address or phone number is already in use.' };
  }

  const roleIds = data.roleIds ?? [];

  // Guard rails so an administrator cannot lock the system or themselves out.
  if (userId === actor.id) {
    const adminRole = await prisma.role.findUnique({ where: { name: ADMIN_ROLE_NAME } });
    const wasAdmin = target.roles.some((r) => r.name === ADMIN_ROLE_NAME);
    const staysAdmin = adminRole ? roleIds.includes(adminRole.id) : false;
    if (wasAdmin && !staysAdmin) {
      return { success: false, error: 'You cannot remove the Admin role from your own account.' };
    }
  }

  const removingAdmin = target.roles.some((r) => r.name === ADMIN_ROLE_NAME);
  if (removingAdmin) {
    const adminRole = await prisma.role.findUnique({ where: { name: ADMIN_ROLE_NAME } });
    const keepsAdmin = adminRole ? roleIds.includes(adminRole.id) : false;
    if (!keepsAdmin) {
      const adminCount = await prisma.user.count({
        where: { roles: { some: { name: ADMIN_ROLE_NAME } }, isActive: true },
      });
      if (adminCount <= 1) {
        return { success: false, error: 'This is the last administrator; the Admin role cannot be removed.' };
      }
    }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        name: `${data.firstName.trim()} ${data.lastName.trim()}`,
        email,
        phoneNumber,
        pmoDivisionId: data.pmoDivisionId || null,
        roles: { set: roleIds.map((id) => ({ id })) },
      },
    });
  } catch (error) {
    console.error('Failed to update user:', error);
    return { success: false, error: 'Failed to update user.' };
  }

  await auditAction(actor, {
    action: AUDIT_ACTIONS.USER_UPDATED,
    entity: 'User',
    entityId: userId,
    details: {
      email: { from: target.email, to: email },
      phoneNumber: { from: target.phoneNumber, to: phoneNumber },
      name: { from: target.name, to: `${data.firstName.trim()} ${data.lastName.trim()}` },
      roleIds: { from: target.roles.map((r) => r.id), to: roleIds },
      pmoDivisionId: { from: target.pmoDivisionId, to: data.pmoDivisionId || null },
    },
  });

  // A permission change must take effect immediately, not whenever the user
  // next happens to sign in.
  const rolesChanged =
    target.roles.length !== roleIds.length ||
    target.roles.some((r) => !roleIds.includes(r.id));
  if (rolesChanged) {
    const revoked = await revokeAllSessionsForUser(userId, 'ROLES_CHANGED');
    await audit('SESSIONS_REVOKED', {
      actorId: actor.id,
      targetUserId: userId,
      detail: `Roles changed; ${revoked} session(s) revoked`,
    });
  }

  revalidatePath('/settings');
  revalidatePath('/config');
  return { success: true };
}

/**
 * Resets another user's password to a generated temporary one.
 *
 * Replaces forgotPasswordForUser/resetPasswordForUser, which obtained a reset
 * token from the external service and returned it to the browser — that pair
 * allowed takeover of any account given only a phone number.
 */
export async function resetUserPassword(
  userId: string,
): Promise<Result<{ temporaryPassword: string }>> {
  const guard = await permit('config:manage-users');
  if (!guard.ok) return guard.denied;
  const actor = guard.user;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!target) return { success: false, error: 'User not found.' };

  // Generated at the configured minimum, so raising the policy cannot start
  // issuing passwords the system will refuse.
  const temporaryPassword = generateTemporaryPassword(
    await getNumber('security.passwordMinLength'),
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const revoked = await revokeAllSessionsForUser(userId, 'PASSWORD_RESET');
  await auditAction(actor, {
    action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
    entity: 'User',
    entityId: userId,
    details: { email: target.email, sessionsRevoked: revoked },
  });
  await audit('PASSWORD_RESET', {
    actorId: actor.id,
    targetUserId: userId,
    detail: `Password reset for ${target.email}; ${revoked} session(s) revoked`,
  });

  revalidatePath('/settings');
  revalidatePath('/config');
  return { success: true, temporaryPassword };
}

/** Enables or disables an account without deleting it or its history. */
export async function setUserActive(userId: string, isActive: boolean): Promise<Result> {
  const guard = await permit('config:manage-users');
  if (!guard.ok) return guard.denied;
  const actor = guard.user;

  if (userId === actor.id && !isActive) {
    return { success: false, error: 'You cannot disable your own account.' };
  }

  if (!isActive) {
    const target = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true } });
    if (target?.roles.some((r) => r.name === ADMIN_ROLE_NAME)) {
      const adminCount = await prisma.user.count({
        where: { roles: { some: { name: ADMIN_ROLE_NAME } }, isActive: true },
      });
      if (adminCount <= 1) {
        return { success: false, error: 'This is the last active administrator and cannot be disabled.' };
      }
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive } });

  if (!isActive) {
    await revokeAllSessionsForUser(userId, 'ACCOUNT_DISABLED');
  }

  await audit(isActive ? 'ACCOUNT_ENABLED' : 'ACCOUNT_DISABLED', {
    actorId: actor.id,
    targetUserId: userId,
  });
  await auditAction(actor, {
    action: isActive ? AUDIT_ACTIONS.USER_ENABLED : AUDIT_ACTIONS.USER_DISABLED,
    entity: 'User',
    entityId: userId,
    details: { isActive },
  });

  revalidatePath('/settings');
  revalidatePath('/config');
  return { success: true };
}

export async function deleteUser(userId: string): Promise<Result> {
  const guard = await permit('config:manage-users');
  if (!guard.ok) return guard.denied;
  const actor = guard.user;

  if (userId === actor.id) {
    return { success: false, error: 'You cannot delete your own account.' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true } });
  if (!target) return { success: false, error: 'User not found.' };

  if (target.roles.some((r) => r.name === ADMIN_ROLE_NAME)) {
    const adminCount = await prisma.user.count({
      where: { roles: { some: { name: ADMIN_ROLE_NAME } }, isActive: true },
    });
    if (adminCount <= 1) {
      return { success: false, error: 'This is the last administrator and cannot be deleted.' };
    }
  }

  try {
    await revokeAllSessionsForUser(userId, 'ACCOUNT_DELETED');
    await prisma.user.delete({ where: { id: userId } });
    await auditAction(actor, {
      action: AUDIT_ACTIONS.USER_DELETED,
      entity: 'User',
      entityId: userId,
      details: {
        email: target.email,
        name: target.name,
        roles: target.roles.map((r) => r.name),
      },
    });
    revalidatePath('/settings');
    revalidatePath('/config');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete user:', error);
    return {
      success: false,
      error:
        'Failed to delete user. They may be associated with projects, tasks, or teams. Reassign their responsibilities first, or disable the account instead.',
    };
  }
}

// -------------------------------------------------------------------- roles

function sanitizePermissions(permissions?: string[]): string[] {
  // Only permissions this system actually defines may be stored, so a crafted
  // request cannot invent one that some future check might honour.
  const known = new Set(allPermissions);
  return [...new Set((permissions ?? []).filter((p) => known.has(p)))];
}

export async function createRole(data: {
  name: string;
  description?: string;
  permissions?: string[];
}): Promise<Result> {
  const guard = await permit('config:manage-roles');
  if (!guard.ok) return guard.denied;

  if (!data?.name?.trim()) return { success: false, error: 'Role name is required.' };

  try {
    const role = await prisma.role.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        permissions: sanitizePermissions(data.permissions),
      },
    });
    await auditAction(guard.user, {
      action: AUDIT_ACTIONS.ROLE_CREATED,
      entity: 'Role',
      entityId: role.id,
      details: { name: role.name, permissions: role.permissions },
    });
    revalidatePath('/settings');
    revalidatePath('/config');
    return { success: true };
  } catch {
    return { success: false, error: 'A role with this name may already exist.' };
  }
}

export async function updateRole(
  id: string,
  data: { name: string; description?: string; permissions?: string[] },
): Promise<Result> {
  const guard = await permit('config:manage-roles');
  if (!guard.ok) return guard.denied;
  const actor = guard.user;

  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return { success: false, error: 'Role not found.' };

  // The Admin role is granted every permission implicitly; letting it be
  // renamed would silently strip that from everyone who holds it.
  if (role.name === ADMIN_ROLE_NAME && data.name?.trim() !== ADMIN_ROLE_NAME) {
    return { success: false, error: 'The Admin role cannot be renamed.' };
  }

  try {
    await prisma.role.update({
      where: { id },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        permissions: sanitizePermissions(data.permissions),
      },
    });
  } catch {
    return { success: false, error: 'Failed to update role.' };
  }

  await auditAction(actor, {
    action: AUDIT_ACTIONS.ROLE_UPDATED,
    entity: 'Role',
    entityId: id,
    details: {
      name: { from: role.name, to: data.name.trim() },
      permissions: { from: role.permissions, to: sanitizePermissions(data.permissions) },
    },
  });

  // Everyone holding this role gets a fresh session so the new permission set
  // applies at once.
  const holders = await prisma.user.findMany({
    where: { roles: { some: { id } } },
    select: { id: true },
  });
  for (const holder of holders) {
    await revokeAllSessionsForUser(holder.id, 'ROLE_PERMISSIONS_CHANGED');
  }
  if (holders.length) {
    await audit('SESSIONS_REVOKED', {
      actorId: actor.id,
      detail: `Role "${role.name}" changed; sessions revoked for ${holders.length} user(s)`,
    });
  }

  revalidatePath('/settings');
  revalidatePath('/config');
  return { success: true };
}

export async function deleteRole(id: string): Promise<Result> {
  const guard = await permit('config:manage-roles');
  if (!guard.ok) return guard.denied;

  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return { success: false, error: 'Role not found.' };
  if (role.name === ADMIN_ROLE_NAME) {
    return { success: false, error: 'The Admin role cannot be deleted.' };
  }

  const inUse = await prisma.user.count({ where: { roles: { some: { id } } } });
  if (inUse > 0) {
    return { success: false, error: 'Cannot delete role as it is currently assigned to one or more users.' };
  }

  try {
    await prisma.role.delete({ where: { id } });
    await auditAction(guard.user, {
      action: AUDIT_ACTIONS.ROLE_DELETED,
      entity: 'Role',
      entityId: id,
      details: { name: role.name, permissions: role.permissions },
    });
    revalidatePath('/settings');
    revalidatePath('/config');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete role.' };
  }
}

export async function assignRoleToUser(userId: string, roleId: string): Promise<Result> {
  const guard = await permit('config:manage-users');
  if (!guard.ok) return guard.denied;
  try {
    await prisma.user.update({ where: { id: userId }, data: { roles: { connect: { id: roleId } } } });
    await revokeAllSessionsForUser(userId, 'ROLES_CHANGED');
    revalidatePath('/settings');
    revalidatePath('/config');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to assign the role.' };
  }
}

export async function removeRoleFromUser(userId: string, roleId: string): Promise<Result> {
  const guard = await permit('config:manage-users');
  if (!guard.ok) return guard.denied;
  const actor = guard.user;

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (role?.name === ADMIN_ROLE_NAME) {
    if (userId === actor.id) {
      return { success: false, error: 'You cannot remove the Admin role from your own account.' };
    }
    const adminCount = await prisma.user.count({
      where: { roles: { some: { name: ADMIN_ROLE_NAME } }, isActive: true },
    });
    if (adminCount <= 1) {
      return { success: false, error: 'This is the last administrator; the Admin role cannot be removed.' };
    }
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { roles: { disconnect: { id: roleId } } } });
    await revokeAllSessionsForUser(userId, 'ROLES_CHANGED');
    revalidatePath('/settings');
    revalidatePath('/config');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to remove the role.' };
  }
}
