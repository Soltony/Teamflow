import { randomUUID } from 'crypto';

import prisma from '@/lib/db';

/**
 * Business audit logging.
 *
 * Adapted from the GuessLow console. Answers "who changed this, when, and what
 * was it before" — the question this system previously could not answer at all,
 * because project edits, approvals and role changes left no record.
 *
 * Authentication outcomes go to AuthEvent instead; see src/app/auth/actions.ts.
 */

export interface AuditLogInput {
  actorId: string;
  actorName?: string | null;
  actorType?: 'USER' | 'SYSTEM';
  /** Past-tense verb, e.g. 'PROJECT_UPDATED'. Use the ACTIONS constants. */
  action: string;
  entity?: string;
  entityId?: string;
  details?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string;
}

const REDACTED = '***REDACTED***';

const SENSITIVE_KEYS = [
  'password',
  'newpassword',
  'currentpassword',
  'temporarypassword',
  'passwordhash',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'signature',
];

function truncate(value: string, maxLen = 8000) {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…(truncated, len=${value.length})`;
}

/**
 * Recursively strips credentials before anything is written.
 *
 * An audit trail is read by more people than the database itself, and it is
 * the one table guaranteed to be retained — so a password or a session token
 * that lands here is a lasting disclosure, not a transient one.
 */
export function sanitizeDetails(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncate(value, 2000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => sanitizeDetails(v, depth + 1));

  if (typeof value === 'object') {
    const anyVal = value as Record<string, unknown> & {
      toNumber?: () => number;
      toFixed?: (n: number) => string;
    };
    // Prisma Decimal and similar wrapper objects serialise to {} otherwise.
    if (typeof anyVal.toNumber === 'function' && typeof anyVal.toFixed === 'function') {
      return Number(String(anyVal));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(anyVal)) {
      out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? REDACTED : sanitizeDetails(v, depth + 1);
    }
    return out;
  }

  return String(value);
}

/** Ties together every audit row written while handling one request. */
export function newCorrelationId(): string {
  return randomUUID();
}

/**
 * Writes one audit row.
 *
 * Never throws: an audit failure must not roll back or block the operation
 * being audited. A write that fails is reported to the server log instead, so
 * the gap is visible rather than silent.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId || 'SYSTEM',
        actorName: input.actorName ?? undefined,
        actorType: input.actorType ?? 'USER',
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        details:
          input.details === undefined
            ? undefined
            : truncate(JSON.stringify(sanitizeDetails(input.details))),
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent?.slice(0, 512) ?? undefined,
        correlationId: input.correlationId,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write audit log', {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      error,
    });
  }
}

/**
 * Reduces a before/after pair to just the fields that changed.
 *
 * Storing whole records makes the log expensive and hard to read; storing the
 * delta makes "what actually changed" answerable at a glance.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
  fields: (keyof T)[],
): Record<string, { from: unknown; to: unknown }> | undefined {
  if (!before || !after) return undefined;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    const from = before[field];
    const to = after[field];
    const same =
      from instanceof Date && to instanceof Date
        ? from.getTime() === to.getTime()
        : JSON.stringify(from ?? null) === JSON.stringify(to ?? null);
    if (!same) changes[String(field)] = { from, to };
  }
  return Object.keys(changes).length ? changes : undefined;
}

/**
 * Action names, so the same event is not spelled three ways across the code
 * and reports can group on it reliably.
 */
export const AUDIT_ACTIONS = {
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  MILESTONE_CREATED: 'MILESTONE_CREATED',
  MILESTONE_UPDATED: 'MILESTONE_UPDATED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_DELETED: 'TASK_DELETED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_REJECTED: 'TASK_REJECTED',
  TIMELINE_CHANGE_APPROVED: 'TIMELINE_CHANGE_APPROVED',
  TIMELINE_CHANGE_REJECTED: 'TIMELINE_CHANGE_REJECTED',
  PAYMENT_APPROVED: 'PAYMENT_APPROVED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_ENABLED: 'USER_ENABLED',
  USER_DISABLED: 'USER_DISABLED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  ROLE_CREATED: 'ROLE_CREATED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  ROLE_DELETED: 'ROLE_DELETED',
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_UPDATED: 'ASSIGNMENT_UPDATED',
  ASSIGNMENT_DELETED: 'ASSIGNMENT_DELETED',
  BLOCKER_RAISED: 'BLOCKER_RAISED',
  BLOCKER_UPDATED: 'BLOCKER_UPDATED',
  BLOCKER_ESCALATED: 'BLOCKER_ESCALATED',
  BLOCKER_RESOLVED: 'BLOCKER_RESOLVED',
  BLOCKER_DELETED: 'BLOCKER_DELETED',
  SETTING_UPDATED: 'SETTING_UPDATED',
} as const;
