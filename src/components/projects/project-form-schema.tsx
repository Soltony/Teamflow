import * as z from "zod";

/**
 * The project form’s shape and its currency helpers.
 *
 * Extracted so the three parts of the form can share one definition without
 * importing each other. The schema is the contract between them: each section
 * edits its own fields of the same object.
 */

export const milestoneSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  startDate: z.date(),
  dueDate: z.date(),
  weight: z.coerce.number().min(0, "Weight must be a positive number.").max(100, "Weight must be between 0 and 100."),
}).refine(data => data.dueDate >= data.startDate, {
    message: "Due date must be on or after the start date.",
    path: ["dueDate"],
});

export const paymentSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(3, "Payment title is required."),
    description: z.string().optional(),
    amount: z.coerce.number().positive("Amount must be a positive number."),
    paymentDate: z.date({ required_error: "A payment date is required." }),
});

export const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  startDate: z.date({ required_error: "A start date is required."}),
  endDate: z.date({ required_error: "An end date is required."}),
  workingYear: z.string().nonempty("An active working year must be set on the Settings page."),
  statusId: z.string().nonempty("Please select a project status."),
  pmoDivisionId: z.string().nonempty("Please select an EPMO division."),
  projectManagerId: z.string().nonempty("Please select a project manager."),
  responsibleDepartmentIds: z.array(z.string()).nonempty({ message: "At least one department must be responsible." }),
  hasMilestones: z.boolean().default(false),
  hasCost: z.boolean().default(false),
  currency: z.string(),
  totalCost: z.coerce.number().optional(),
  milestones: z.array(milestoneSchema).optional(),
  payments: z.array(paymentSchema).optional(),
  timelineChangeReason: z.string().optional(),
}).refine(data => data.endDate > data.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
}).refine(data => {
    if (!data.hasMilestones || !data.milestones || data.milestones.length === 0) return true;
    const totalWeight = data.milestones.reduce((sum, m) => sum + m.weight, 0);
    return totalWeight === 100;
}, {
    message: "If milestones are provided, their total weight must sum to exactly 100.",
    path: ["milestones"],
}).superRefine((data, ctx) => {
    if (data.hasMilestones && data.milestones) {
        data.milestones.forEach((milestone, index) => {
            if (milestone.startDate < data.startDate) {
                ctx.addIssue({
                    path: [`milestones.${index}.startDate`],
                    message: "Start date cannot be before the project's start date.",
                    code: z.ZodIssueCode.custom
                });
            }
            if (milestone.dueDate > data.endDate) {
                ctx.addIssue({
                    path: [`milestones.${index}.dueDate`],
                    message: "Due date cannot be after the project's end date.",
                    code: z.ZodIssueCode.custom
                });
            }
        });
    }

    if (data.hasCost && data.payments && data.payments.length > 0) {
        const paymentTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
        if (data.totalCost !== paymentTotal) {
            const currencySymbol = data.currency === 'USD' ? '$' : 'ETB';
            ctx.addIssue({
                path: ["totalCost"],
                message: `The sum of payment items (${currencySymbol} ${paymentTotal.toLocaleString()}) must equal the total project cost (${currencySymbol} ${(data.totalCost || 0).toLocaleString()}).`,
                code: z.ZodIssueCode.custom
            });
        }
    }
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const formatCurrency = (value: number | string | undefined) => {
    if (value === undefined || value === null) return '';
    const num = Number(String(value).replace(/,/g, ''));
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('en-US').format(num);
};

export const unformatCurrency = (value: string) => {
    return value.replace(/,/g, '');
}

/**
 * What the form is seeded with, as opposed to what it produces.
 *
 * The schema requires at least one responsible department, so its inferred
 * type is a non-empty tuple. That is the right rule at submission and the
 * wrong one for initial state: the create form starts empty, and an existing
 * project may have none recorded yet. Validation still enforces the rule when
 * the user submits — this only stops the seed value from having to lie.
 */
export type ProjectFormInitialValues = Omit<ProjectFormValues, "responsibleDepartmentIds"> & {
  responsibleDepartmentIds: string[];
};
