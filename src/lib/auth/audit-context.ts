import 'server-only';

import { headers } from 'next/headers';

import { createAuditLog, newCorrelationId, type AuditLogInput } from '@/lib/audit-log';
import { clientAddress, userAgent } from '@/lib/request-context';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Writes an audit entry for the acting user, filling in the request context.
 *
 * Server actions call this rather than createAuditLog directly, so no call site
 * has to remember to attach the address, the user agent, or the actor's name —
 * the fields most likely to be forgotten and most needed when reading the log
 * back.
 */
export async function auditAction(
  actor: Pick<SessionUser, 'id' | 'name'>,
  entry: Omit<AuditLogInput, 'actorId' | 'actorName' | 'ipAddress' | 'userAgent'>,
): Promise<void> {
  let ipAddress: string | null = null;
  let agent: string | null = null;
  try {
    const h = await headers();
    ipAddress = clientAddress(h);
    agent = userAgent(h);
  } catch {
    // Outside a request (a script, a background job): the entry is still worth
    // writing without the transport details.
  }

  await createAuditLog({
    ...entry,
    actorId: actor.id,
    actorName: actor.name,
    ipAddress,
    userAgent: agent,
    correlationId: entry.correlationId ?? newCorrelationId(),
  });
}

/** For events with no human actor, such as a scheduled job. */
export async function auditSystem(
  entry: Omit<AuditLogInput, 'actorId' | 'actorName' | 'actorType'>,
): Promise<void> {
  await createAuditLog({
    ...entry,
    actorId: 'SYSTEM',
    actorName: null,
    actorType: 'SYSTEM',
    correlationId: entry.correlationId ?? newCorrelationId(),
  });
}
