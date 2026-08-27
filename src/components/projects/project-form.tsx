"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormSection, FormWizard, type WizardStep } from "@/components/ui/form-wizard";
import type { Department, ProjectStatus, PmoDivision } from "@prisma/client";
import type { UserWithRoles } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { ProjectFormMilestones } from "./project-form-milestones";
import { ProjectFormCost } from "./project-form-cost";
import { ProjectReviewStep } from "./project-form-review";
import {
  projectSchema,
  type ProjectFormValues,
  type ProjectFormInitialValues,
} from "./project-form-schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import type { Serialized } from "@/lib/serialize";
import { useFormDraft } from "@/hooks/use-form-draft";

type ProjectFormProps = {
  mode: 'create' | 'edit';
  initialData?: ProjectFormInitialValues;
  users: UserWithRoles[];
  pmoDivisions: Serialized<PmoDivision>[];
  departments: Serialized<Department>[];
  projectStatuses: Serialized<ProjectStatus>[];
  onSubmit: (data: ProjectFormValues) => Promise<any>;
};

/**
 * Registering or editing a project, one decision at a time.
 *
 * This was a single scroll: nine identifying fields, then a milestones section
 * that repeats a five-field block per milestone, then a payments section that
 * repeats another four, with one Submit button at the very bottom. Three
 * milestones and three payments put over forty inputs on one page. The costs
 * of that were specific:
 *
 *  - a required field left blank near the top reported its error a screen and
 *    a half above where the reader was working, and nothing said which section
 *    had failed;
 *  - the milestone weights must total exactly 100 and the payment schedule must
 *    total exactly the project cost, but neither running total was shown, so
 *    both rules were discovered by failing them;
 *  - somebody editing one field on an existing project scrolled past
 *    everything else to reach it.
 *
 * The steps below are the same fields and the same schema — nothing about what
 * is submitted has changed. What changed is that each step validates only the
 * fields it owns, so errors appear beside the input that caused them, and the
 * step list shows at a glance which part still needs work.
 */
export function ProjectForm({ mode, initialData, users, pmoDivisions, departments, projectStatuses, onSubmit }: ProjectFormProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimelineChangeDialogOpen, setIsTimelineChangeDialogOpen] = useState(false);
  const [originalEndDate, setOriginalEndDate] = useState<Date | undefined>(initialData?.endDate);
  const [stepIndex, setStepIndex] = useState(0);

  const isEditMode = mode === 'edit';
  const canRequestTimelineChange = hasPermission('timeline:request');

  const nonAdminUsers = useMemo(() => {
    return users.filter(user => !user.roles.some(role => role.name === 'Admin'));
  }, [users]);

  const getCurrentWorkingYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed (January is 0)
    if (month >= 6) {
      return `${year}/${year + 1}`;
    } else {
      return `${year - 1}/${year}`;
    }
  };

  const augmentedInitialData = isEditMode && initialData
  ? { ...initialData, hasMilestones: !!(initialData.milestones && initialData.milestones.length > 0) }
  : {
      name: "",
      description: "",
      workingYear: getCurrentWorkingYear(),
      statusId: "",
      pmoDivisionId: "",
      projectManagerId: "",
      responsibleDepartmentIds: [],
      hasMilestones: false,
      hasCost: false,
      // Narrowed by the shared schema now, so the literal has to be one of the
      // two the enum allows rather than any string.
      currency: 'ETB' as const,
      totalCost: 0,
      milestones: [],
      payments: [],
    };

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: augmentedInitialData,
  });

  const selectedPmoDivisionId = form.watch("pmoDivisionId");
  const hasMilestones = form.watch("hasMilestones");
  const hasCost = form.watch("hasCost");
  const currency = form.watch("currency");
  const currencySymbol = currency === 'USD' ? '$' : 'ETB';

  const projectManagers = useMemo(() => {
    const usersToFilter = nonAdminUsers;
    if (!selectedPmoDivisionId) {
      return usersToFilter;
    }
    return usersToFilter.filter(user => user.pmoDivisionId === selectedPmoDivisionId);
  }, [selectedPmoDivisionId, nonAdminUsers]);

  useEffect(() => {
    if (isEditMode && initialData) {
        const resetData = {
            ...initialData,
            hasMilestones: !!(initialData.milestones && initialData.milestones.length > 0)
        }
        form.reset(resetData);
        setOriginalEndDate(initialData.endDate);
    }
  }, [initialData, isEditMode, form]);

  /**
   * The draft, so a refresh does not cost the reader their work.
   *
   * Only on create. An edit form is already seeded from a saved project, and
   * restoring a stale draft over it would silently resurrect changes somebody
   * had abandoned — which is much worse than retyping.
   */
  const { draft, save: saveDraft, clear: clearDraft, savedAt } = useFormDraft<ProjectFormValues>(
    'project-create',
    !isEditMode,
  );
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (isEditMode || !draft || draftRestored) return;
    form.reset(draft);
    setDraftRestored(true);
  }, [draft, draftRestored, isEditMode, form]);

  // Watches every field; the hook debounces the actual write.
  useEffect(() => {
    if (isEditMode) return;
    const subscription = form.watch((values) => saveDraft(values as ProjectFormValues));
    return () => subscription.unsubscribe();
  }, [form, saveDraft, isEditMode]);

  // Passed whole to the section that owns each list, rather than destructured
  // here and threaded through as six separate props.
  const milestoneArray = useFieldArray({ control: form.control, name: "milestones" });
  const paymentArray = useFieldArray({ control: form.control, name: "payments" });

  const milestonesError = form.formState.errors.milestones?.root;

  /**
   * The steps, and the fields each one is responsible for.
   *
   * `fields` is what gets validated on the way out of a step. Listing them
   * explicitly is what stops a milestone weight error from blocking the basics
   * step, and vice versa — validating the whole form at every step would put
   * every reader back where the single-page form had them.
   */
  const steps: WizardStep[] = [
    {
      id: 'basics',
      label: 'Basics',
      description: 'What it is called, what it delivers, and where it stands.',
      fields: ['name', 'description', 'statusId'],
    },
    {
      id: 'schedule',
      label: 'Schedule',
      description: 'When delivery starts and when it is committed to finish.',
      fields: ['startDate', 'endDate', 'workingYear'],
    },
    {
      id: 'structure',
      label: 'Structure',
      description: 'Break the work into milestones so progress can be measured against a plan.',
      fields: ['hasMilestones', 'milestones'],
      optional: true,
    },
    {
      id: 'budget',
      label: 'Budget',
      description: 'What it costs and the schedule it is paid against.',
      fields: ['hasCost', 'totalCost', 'currency', 'payments'],
      optional: true,
    },
    {
      id: 'team',
      label: 'Team',
      description: 'Who runs it, which division owns it, and who it is being delivered for.',
      fields: ['pmoDivisionId', 'projectManagerId', 'responsibleDepartmentIds'],
    },
    {
      id: 'review',
      label: 'Review',
      description: 'Check everything before it goes in.',
    },
  ];

  /**
   * Which steps are currently failing.
   *
   * Derived from the live error state rather than tracked separately, so a
   * problem fixed on step two stops being flagged the moment it is fixed
   * rather than at the next submit.
   */
  const invalidSteps = useMemo(() => {
    const errors = form.formState.errors as Record<string, unknown>;
    const failing = new Set<string>();
    for (const step of steps) {
      if (step.fields?.some((field) => Boolean(errors[field]))) failing.add(step.id);
    }
    return failing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.formState.errors]);

  /**
   * Every step is shown.
   *
   * The milestones and cost steps carry their own on/off switch as their first
   * control, so hiding the step would hide the switch and leave no way to turn
   * the section on. They are marked optional in the list instead, and a reader
   * who does not want them passes through in one click.
   */
  const visibleSteps = steps;

  const handleNext = async () => {
    const step = visibleSteps[stepIndex];
    if (!step?.fields || step.fields.length === 0) return true;
    return form.trigger(step.fields as (keyof ProjectFormValues)[]);
  };

  async function handleFormSubmit(data: ProjectFormValues) {
    if (isEditMode && canRequestTimelineChange && originalEndDate && data.endDate.getTime() !== originalEndDate.getTime()) {
      setIsTimelineChangeDialogOpen(true);
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit(data);
    setIsSubmitting(false);
    // Only once it has actually landed: clearing on submit would lose the
    // draft for somebody whose save just failed.
    if (result?.success !== false) clearDraft();
  }

  /**
   * Submitting from the last step.
   *
   * A failure anywhere jumps the reader to the first step that has one, rather
   * than leaving them on Review with a button that silently does nothing —
   * which is what a single Submit at the bottom of a long form did whenever a
   * field above the fold was invalid.
   */
  const handleSubmitClick = form.handleSubmit(handleFormSubmit, (errors) => {
    const firstBad = visibleSteps.findIndex((step) =>
      step.fields?.some((field) => Boolean((errors as Record<string, unknown>)[field])),
    );
    if (firstBad >= 0) setStepIndex(firstBad);
  });

  async function handleTimelineChangeSubmit() {
    const reason = form.getValues("timelineChangeReason");
    if (!reason || reason.length < 10) {
        form.setError("timelineChangeReason", { type: "manual", message: "A reason of at least 10 characters is required." });
        return;
    }

    setIsTimelineChangeDialogOpen(false);
    setIsSubmitting(true);
    await onSubmit(form.getValues());
    setIsSubmitting(false);
  }

  const currentStepId = visibleSteps[stepIndex]?.id;

  return (
    <>
    <Form {...form}>
      {/*
        One form element around every step, so values persist as the reader
        moves between them and the final submit sends exactly what a
        single-page form would have sent. Enter is intercepted because on a
        multi-step form it would otherwise submit a half-filled project from
        step one.
      */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (currentStepId === 'review') handleSubmitClick();
        }}
      >
        <FormWizard
          steps={visibleSteps}
          currentStep={stepIndex}
          onStepChange={setStepIndex}
          invalidSteps={invalidSteps}
          onNext={handleNext}
          isSubmitting={isSubmitting}
          submitLabel={isEditMode ? 'Save changes' : 'Create project'}
          onSubmit={handleSubmitClick}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              {/*
                Says the draft exists rather than leaving the reader to hope.
                A form that silently saves is indistinguishable from one that
                silently does not.
              */}
              {!isEditMode && savedAt && (
                <span className="text-xs text-muted-foreground">
                  Draft kept for this session · saved {format(savedAt, 'HH:mm')}
                </span>
              )}
            </>
          }
        >
          {currentStepId === 'basics' && (
            <FormSection>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Core Banking Platform Upgrade" {...field} />
                    </FormControl>
                    <FormDescription>
                      How it will appear in every report and on the portfolio dashboard.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What it will deliver</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the outcome this project is accountable for, not the activity."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Read by people who were not in the room when it was agreed. At least 10
                      characters.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/*
                Status belongs with the basics rather than with ownership: it
                describes the project, not who runs it, and somebody registering
                a project sets it in the same breath as the name.
              */}
              <FormField
                control={form.control}
                name="statusId"
                render={({ field }) => (
                  <FormItem className="max-w-sm">
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projectStatuses.map(status => <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormDescription>How delivery is currently going.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>
          )}

          {currentStepId === 'schedule' && (
            <FormSection>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DateField
                  form={form}
                  name="startDate"
                  label="Start date"
                  description="When delivery work begins."
                />
                <DateField
                  form={form}
                  name="endDate"
                  label="Committed end date"
                  description={
                    isEditMode
                      ? 'Moving this raises a timeline change request for approval.'
                      : 'The date the project is judged against. Extensions are measured from it.'
                  }
                  disabledBefore={form.getValues('startDate')}
                />
              </div>
              <FormField
                control={form.control}
                name="workingYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Working year</FormLabel>
                    <FormControl>
                      <Input placeholder="Set the active year in Settings" {...field} disabled />
                    </FormControl>
                    <FormDescription>
                      {isEditMode
                        ? 'The working year cannot be changed once a project exists.'
                        : 'Taken from the active year set in Settings, so the portfolio reports line up.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>
          )}

          {currentStepId === 'team' && (
            <FormSection>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="pmoDivisionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owning EPMO division</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a division" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pmoDivisions.map(div => <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormDescription>Narrows the managers you can choose from.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="projectManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project manager</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                selectedPmoDivisionId
                                  ? 'Select a manager'
                                  : 'Choose a division first'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectManagers.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {selectedPmoDivisionId
                          ? `${projectManagers.length} available in this division.`
                          : 'All managers are listed until a division is chosen.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="responsibleDepartmentIds"
                  render={({ field }) => {
                    const selectedDepts = departments.filter(dept => field.value?.includes(dept.id));
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Responsible departments</FormLabel>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn("w-full justify-start font-normal", !field.value?.length && "text-muted-foreground")}
                              >
                                <span className="min-w-0 truncate">
                                  {selectedDepts.length > 0
                                    ? selectedDepts.map(d => d.name).join(', ')
                                    : "Select departments…"}
                                </span>
                                <ChevronDown className="ml-auto h-4 w-4 shrink-0" />
                              </Button>
                            </FormControl>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                            {departments.map((dept) => (
                              <DropdownMenuCheckboxItem
                                key={dept.id}
                                checked={field.value?.includes(dept.id)}
                                onCheckedChange={(checked) => {
                                  const newValues = field.value ? [...field.value] : [];
                                  if (checked) {
                                    newValues.push(dept.id);
                                  } else {
                                    const idx = newValues.indexOf(dept.id);
                                    if (idx > -1) newValues.splice(idx, 1);
                                  }
                                  field.onChange(newValues);
                                }}
                              >
                                {dept.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <FormDescription>
                          {selectedDepts.length > 0
                            ? `${selectedDepts.length} selected.`
                            : 'The business departments this is being delivered for. At least one.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            </FormSection>
          )}

          {currentStepId === 'structure' && (
            <ProjectFormMilestones
              form={form}
              fieldArray={milestoneArray}
              enabled={hasMilestones}
              weightError={milestonesError}
            />
          )}

          {currentStepId === 'budget' && (
            <ProjectFormCost
              form={form}
              fieldArray={paymentArray}
              enabled={hasCost}
              currencySymbol={currencySymbol}
            />
          )}

          {currentStepId === 'review' && (
            <ProjectReviewStep
              form={form}
              mode={mode}
              pmoDivisions={pmoDivisions}
              departments={departments}
              projectStatuses={projectStatuses}
              users={users}
              currencySymbol={currencySymbol}
              onEditStep={(id) => {
                const index = visibleSteps.findIndex((s) => s.id === id);
                if (index >= 0) setStepIndex(index);
              }}
            />
          )}
        </FormWizard>
      </form>
    </Form>

    <AlertDialog open={isTimelineChangeDialogOpen} onOpenChange={setIsTimelineChangeDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Why is the deadline moving?</AlertDialogTitle>
                <AlertDialogDescription>
                    You have changed the committed end date
                    {originalEndDate ? ` from ${format(originalEndDate, 'd MMM yyyy')}` : ''}
                    {form.getValues('endDate') ? ` to ${format(form.getValues('endDate'), 'd MMM yyyy')}` : ''}.
                    That needs approval before it takes effect, and the original date stays on record
                    so the project is still measured against what was committed.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Form {...form}>
                <div id="timeline-change-form">
                     <FormField
                        control={form.control}
                        name="timelineChangeReason"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Reason</FormLabel>
                            <FormControl>
                                <Textarea
                                  placeholder="e.g. Vendor delivery slipped four weeks; integration cannot start until hardware arrives."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                            </FormControl>
                            <FormDescription>
                              Read by whoever approves it. At least 10 characters.
                            </FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </Form>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  type="button"
                  onClick={(e) => {
                    // The dialog closes on click by default, which submitted
                    // the form even when the reason failed validation.
                    e.preventDefault();
                    handleTimelineChangeSubmit();
                  }}
                >
                  Submit for approval
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

/**
 * A date field with its calendar.
 *
 * Written once rather than three times: the two project dates and the two
 * dates on every milestone were the same twenty lines of Popover markup
 * repeated, and the accessible name was carried only by the visible label, so
 * the trigger read as "Pick a date" to a screen reader whichever field it was.
 */
function DateField({
  form,
  name,
  label,
  description,
  disabledBefore,
}: {
  form: ReturnType<typeof useForm<ProjectFormValues>>;
  name: 'startDate' | 'endDate';
  label: string;
  description?: string;
  disabledBefore?: Date;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>{label}</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  aria-label={field.value ? `${label}: ${format(field.value, 'PPP')}` : `${label}: not set`}
                  className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                >
                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" aria-hidden="true" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={field.onChange}
                disabled={disabledBefore ? (date) => date < disabledBefore : undefined}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
