import type * as z from "zod";

import { createProjectSchema } from "@/lib/validation/project";

/**
 * The project form's contract — which is the server's contract.
 *
 * This file used to hold a second, hand-maintained copy of the project rules.
 * The two had already drifted: the server required milestone weights to total
 * exactly 100 and rejected a cost without a total, the browser copy checked
 * neither in the same way, and the server's own comment claimed the schema was
 * shared when it was not.
 *
 * A duplicated validator is worse than no validator on one side, because it
 * looks like agreement. The form now resolves against `createProjectSchema`
 * itself, so a rule can only be changed in the place the action enforces it.
 *
 * The server schema accepts a Date or an ISO string for every date, which is
 * what makes sharing it possible: the form supplies Date objects from its
 * pickers, and a server action receives the serialised strings.
 */

export const projectSchema = createProjectSchema;

export type ProjectFormValues = z.infer<typeof createProjectSchema>;

/**
 * What the form is seeded with, as opposed to what it produces.
 *
 * Distinct from the submitted type because a blank create form legitimately
 * starts with no departments selected and no dates picked, while the schema
 * requires both at submission. Seeding with a value that satisfies the schema
 * would mean pre-filling fields nobody chose.
 */
export type ProjectFormInitialValues = Omit<
  ProjectFormValues,
  "responsibleDepartmentIds" | "startDate" | "endDate"
> & {
  responsibleDepartmentIds: string[];
  startDate?: Date;
  endDate?: Date;
};

/**
 * Thousands separators while typing an amount.
 *
 * Presentation only — the parsed number is what reaches the schema — but it
 * belongs beside the form rather than in the shared validator, which has no
 * business knowing how a field is displayed.
 */
export const formatCurrency = (value: number | string | undefined) => {
  if (value === undefined || value === null) return "";
  const num = Number(String(value).replace(/,/g, ""));
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-US").format(num);
};

export const unformatCurrency = (value: string) => value.replace(/,/g, "");
