"use client";

import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { checkWeights } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { ProjectFormValues } from "./project-form-schema";

/**
 * How much of the project has been allocated so far.
 *
 * The weight rule is "must total exactly 100", enforced only at submit. Showing
 * the running total turns that from a rejection into a target — the reader can
 * see there are 15 points left while they are still typing.
 */
function WeightMeter({
  form,
  count,
}: {
  form: UseFormReturn<ProjectFormValues>;
  count: number;
}) {
  const milestones = form.watch("milestones") ?? [];
  const { total, isComplete, remaining } = checkWeights(milestones.map((m) => m?.weight));

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        isComplete
          ? "border-success/30 bg-success-soft"
          : "border-warning/40 bg-warning-soft",
      )}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {count} milestone{count === 1 ? "" : "s"}, {total}% allocated
        </span>
        <span className={cn("tabular-nums", isComplete ? "text-success-strong" : "text-warning-strong")}>
          {isComplete
            ? "Totals 100% — ready"
            : remaining > 0
              ? `${remaining}% still to allocate`
              : `${Math.abs(remaining)}% over`}
        </span>
      </div>
      <Progress
        value={Math.min(100, total)}
        className="h-2"
        aria-label={`Milestone weight allocated: ${total} of 100 percent`}
      />
    </div>
  );
}

/**
 * The milestones half of the project form.
 *
 * Split out of project-form.tsx, which had reached nearly nine hundred lines
 * holding three unrelated sections in one function. Nothing here is shared
 * with payments or with the core details, so nothing is gained by them sitting
 * together — and a change to the weight rules had to be made inside eight
 * hundred lines of unrelated markup.
 */
export function ProjectFormMilestones({
  form,
  fieldArray,
  enabled,
  weightError,
}: {
  form: UseFormReturn<ProjectFormValues>;
  fieldArray: UseFieldArrayReturn<ProjectFormValues, "milestones">;
  enabled: boolean;
  weightError?: { message?: string };
}) {
  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = fieldArray;
  const hasMilestones = enabled;
  const milestonesError = weightError;

  return (
    <>
        
        <div className="space-y-4">
             <FormField
                control={form.control}
                name="hasMilestones"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <FormLabel className="text-base">This project has milestones</FormLabel>
                    <FormDescription>
                        Enable to define the major milestones for this project.
                    </FormDescription>
                    </div>
                    <FormControl>
                    <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                    />
                    </FormControl>
                </FormItem>
                )}
            />
            {hasMilestones && (
                <div className="space-y-4 p-4 border rounded-lg">
                    <div>
                        <h3 className="text-lg font-medium">Milestones</h3>
                        <p className="text-sm text-muted-foreground">Weights say how much of the project each milestone represents, and must total exactly 100%.</p>
                    </div>

                    {/*
                      The running total, shown while the weights are being
                      entered rather than reported as a validation failure after
                      submit. The rule is arithmetic across repeated blocks, so
                      the only way to satisfy it without this was to add the
                      numbers up by hand.
                    */}
                    {milestoneFields.length > 0 && <WeightMeter form={form} count={milestoneFields.length} />}
                    {milestoneFields.map((field, index) => (
                    <Card key={field.id} className="relative">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeMilestone(index)}>
                            <X className="h-4 w-4" />
                        </Button>
                        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name={`milestones.${index}.title`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Milestone Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Q1 Goals" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name={`milestones.${index}.description`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Milestone Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Describe the milestone goals and deliverables." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name={`milestones.${index}.startDate`}
                                    render={({ field: dateField }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Start Date</FormLabel>
                                        <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}
                                            >
                                                {dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                                        </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`milestones.${index}.dueDate`}
                                    render={({ field: dateField }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Due Date</FormLabel>
                                        <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}
                                            >
                                                {dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                                        </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            
                            <FormField
                                control={form.control}
                                name={`milestones.${index}.weight`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Milestone Weight (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 25" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        </CardContent>
                    </Card>
                    ))}

                    {milestoneFields.length === 0 && (
                      <EmptyState
                        title="No milestones yet"
                        description="Add the major stages of this project. Each one carries a weight, and the weights must total 100%."
                        compact
                      />
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            // Seeded with whatever weight is still unallocated,
                            // so a three-milestone project does not start at
                            // 60% and have to be corrected by hand.
                            const current = form.getValues('milestones') ?? [];
                            const used = current.reduce((sum, m) => sum + Number(m?.weight ?? 0), 0);
                            appendMilestone({
                                title: '',
                                description: '',
                                startDate: form.getValues('startDate') ?? new Date(),
                                dueDate: form.getValues('endDate') ?? new Date(),
                                weight: Math.max(0, Math.round(100 - used)),
                            });
                        }}
                    >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Add milestone
                    </Button>
                    {milestonesError && (
                        <p className="text-sm font-medium text-destructive" role="alert">{milestonesError.message}</p>
                    )}
                </div>
            )}
        </div>

    </>
  );
}
