import * as z from 'zod';

import { checkWeights } from '@/lib/metrics';

/**
 * The project rules, in one place, enforced on both sides.
 *
 * These rules existed only in the browser: `createProject(data: any)` and
 * `updateProject(projectId, data: any)` spread whatever arrived straight into
 * Prisma. Every invariant the form promised — milestone weights totalling 100,
 * payment items summing to the project cost, milestones falling inside the
 * project window — could be bypassed by calling the action directly, and the
 * spread also allowed writing fields the form never exposes.
 *
 * The same schema now runs in the form (for immediate feedback) and in the
 * action (where it is actually enforced).
 */

/** Accepts a Date or the ISO string a server action receives after serialisation. */
const dateish = z.union([z.date(), z.string().min(1)]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date.' });
    return z.NEVER;
  }
  return date;
});

export const milestoneInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(200),
    description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(2000),
    startDate: dateish,
    dueDate: dateish,
    weight: z.coerce.number().min(0, 'Weight cannot be negative.').max(100, 'Weight cannot exceed 100.'),
  })
  .refine((m) => m.dueDate >= m.startDate, {
    message: 'Due date must be on or after the start date.',
    path: ['dueDate'],
  });

export const paymentInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, 'Payment title is required.').max(200),
  description: z.string().trim().max(2000).optional(),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  paymentDate: dateish,
});

const baseProjectSchema = z.object({
  name: z.string().trim().min(3, 'Project name must be at least 3 characters.').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(5000),
  startDate: dateish,
  endDate: dateish,
  workingYear: z.string().trim().min(1, 'An active working year must be set on the Settings page.'),
  statusId: z.string().trim().min(1, 'Please select a project status.'),
  pmoDivisionId: z.string().trim().min(1, 'Please select an EPMO division.'),
  // The divisions helping deliver, beside the one accountable for it. Optional
  // — most projects are run by their owning division alone.
  participatingDivisionIds: z.array(z.string().min(1)).default([]),
  projectManagerId: z.string().trim().min(1, 'Please select a project manager.'),
  responsibleDepartmentIds: z
    .array(z.string().min(1))
    .min(1, 'At least one department must be responsible.'),
  hasMilestones: z.boolean().default(false),
  hasCost: z.boolean().default(false),
  currency: z.enum(['ETB', 'USD']).default('ETB'),
  totalCost: z.coerce.number().nonnegative().optional(),
  milestones: z.array(milestoneInputSchema).optional(),
  payments: z.array(paymentInputSchema).optional(),
  timelineChangeReason: z.string().trim().max(2000).optional(),
});

/**
 * The cross-field rules. Split out so create and update share exactly one copy
 * — they diverged before, which is how the weight rule ended up enforced on
 * one path and not the other.
 */
function applyProjectInvariants(schema: typeof baseProjectSchema) {
  return schema
    .refine((data) => data.endDate > data.startDate, {
      message: 'End date must be after start date.',
      path: ['endDate'],
    })
    // The owner is on the project by definition. Listing it again would double
    // count it in every "which divisions are involved" figure.
    .refine((data) => !data.participatingDivisionIds.includes(data.pmoDivisionId), {
      message: 'The owning division is already on the project. List only the other divisions taking part.',
      path: ['participatingDivisionIds'],
    })
    .refine(
      (data) => new Set(data.participatingDivisionIds).size === data.participatingDivisionIds.length,
      {
        message: 'A division can only be listed once.',
        path: ['participatingDivisionIds'],
      },
    )
    .superRefine((data, ctx) => {
      if (data.hasMilestones && data.milestones?.length) {
        // Weights must total 100, not merely stay under it. Allowing less is
        // what let a fully delivered project report short of 100%.
        const { isComplete, total } = checkWeights(data.milestones.map((m) => m.weight));
        if (!isComplete) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['milestones'],
            message: `Milestone weights must total exactly 100. They currently total ${total}.`,
          });
        }

        data.milestones.forEach((milestone, index) => {
          if (milestone.startDate < data.startDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['milestones', index, 'startDate'],
              message: "Start date cannot be before the project's start date.",
            });
          }
          if (milestone.dueDate > data.endDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['milestones', index, 'dueDate'],
              message: "Due date cannot be after the project's end date.",
            });
          }
        });
      }

      if (data.hasCost) {
        if (data.totalCost === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['totalCost'],
            message: 'Enter the total project cost.',
          });
        } else if (data.payments?.length) {
          const paid = data.payments.reduce((sum, p) => sum + p.amount, 0);
          // Compare to the cent, not exactly: these are hand-entered decimals.
          if (Math.abs(paid - data.totalCost) > 0.01) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['totalCost'],
              message: `The payment items total ${paid.toLocaleString()}, which must equal the project cost of ${data.totalCost.toLocaleString()}.`,
            });
          }
        }
      }
    });
}

export const createProjectSchema = applyProjectInvariants(baseProjectSchema);
export const updateProjectSchema = applyProjectInvariants(baseProjectSchema);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/** Tasks carry weights too, and the same "must total 100" rule applies. */
export const taskInputSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(200),
    description: z.string().trim().max(2000).default(''),
    startDate: dateish,
    endDate: dateish,
    weight: z.coerce.number().min(0).max(100),
    progress: z.coerce.number().min(0).max(100).optional(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'PENDING_REVIEW', 'DONE']).optional(),
    assignedUserIds: z.array(z.string().min(1)).default([]),
    milestoneId: z.string().optional().nullable(),
  })
  .refine((t) => t.endDate >= t.startDate, {
    message: 'End date must be on or after the start date.',
    path: ['endDate'],
  });

export type TaskInput = z.infer<typeof taskInputSchema>;

/**
 * Formats a ZodError as one message for a toast, keeping the field name so the
 * user knows what to fix.
 */
export function formatValidationError(error: z.ZodError): string {
  const issues = error.issues.slice(0, 3).map((issue) => {
    const field = issue.path.filter((p) => typeof p === 'string').join('.');
    return field ? `${field}: ${issue.message}` : issue.message;
  });
  const extra = error.issues.length > 3 ? ` (+${error.issues.length - 3} more)` : '';
  return issues.join(' · ') + extra;
}
