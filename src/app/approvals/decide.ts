'use server';

import { z } from 'zod';

import { approveTask, rejectTask } from '@/app/task-approvals/actions';
import { approveTimelineChange, rejectTimelineChange } from '@/app/timeline-approvals/actions';
import { approvePayment, rejectPayment } from '@/app/payment-approvals/actions';

/**
 * Deciding, whatever kind it is.
 *
 * The three existing actions already carry the permission checks, the audit
 * entries and the side effects — closing a milestone, moving a baseline,
 * releasing money — so this dispatches to them rather than reimplementing any
 * of it. What it adds is the two things the separate queues could not:
 *
 *  - one entry point, so the inbox can act on a mixed selection;
 *  - a rejection reason that is *required by the type*, not by whichever
 *    dialog happened to be open. The old screens each validated the reason in
 *    their own form, which meant a caller reaching the action another way
 *    could reject with nothing at all.
 */

const KINDS = ['task', 'timeline', 'payment'] as const;

/**
 * A rejection reason, enforced here rather than in the form.
 *
 * Ten characters is the same minimum the three dialogs used; stating it once
 * means it cannot drift between them, and a server action is an HTTP endpoint,
 * so a rule that only runs in the browser is a suggestion.
 */
const decisionSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('approve'),
    kind: z.enum(KINDS),
    entityId: z.string().min(1),
  }),
  z.object({
    decision: z.literal('reject'),
    kind: z.enum(KINDS),
    entityId: z.string().min(1),
    reason: z
      .string()
      .trim()
      .min(10, 'Give a reason of at least 10 characters — it is all the submitter receives.')
      .max(2000),
  }),
]);

export type DecisionInput = z.infer<typeof decisionSchema>;

export interface DecisionResult {
  success: boolean;
  error?: string;
}

/** Decides one item. Used directly, and by the bulk path below. */
export async function decideApproval(input: unknown): Promise<DecisionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'That request was not valid.' };
  }
  const data = parsed.data;

  try {
    if (data.decision === 'approve') {
      switch (data.kind) {
        case 'task':
          return await approveTask(data.entityId);
        case 'timeline':
          return await approveTimelineChange(data.entityId);
        case 'payment':
          return await approvePayment(data.entityId, 'Approved from the approvals inbox');
      }
    }

    switch (data.kind) {
      case 'task':
        return await rejectTask(data.entityId, undefined, data.reason);
      case 'timeline':
        return await rejectTimelineChange(data.entityId, undefined, data.reason);
      case 'payment':
        return await rejectPayment(data.entityId, data.reason);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'The decision could not be recorded.',
    };
  }
}

export interface BulkDecisionResult {
  succeeded: number;
  failed: number;
  /** The first failure's message, which is the one worth showing. */
  firstError?: string;
}

/**
 * Decides a selection, one at a time.
 *
 * Sequential on purpose. Approving a task recalculates its milestone's
 * progress and may close it; approving a payment rewrites the project's
 * committed spend. Firing those concurrently against the same project races on
 * exactly the rows they each just read. Slower, and correct.
 *
 * Partial success is reported as partial success rather than as a failure —
 * telling a reviewer that a batch failed when nine of ten landed makes them
 * redo work that is already done.
 */
export async function decideApprovals(inputs: unknown[]): Promise<BulkDecisionResult> {
  let succeeded = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (const input of inputs) {
    const result = await decideApproval(input);
    if (result.success) {
      succeeded += 1;
    } else {
      failed += 1;
      firstError ??= result.error;
    }
  }

  return { succeeded, failed, firstError };
}
