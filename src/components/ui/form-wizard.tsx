'use client';

import * as React from 'react';
import { Check, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A long form, broken into steps somebody can actually finish.
 *
 * Creating a project meant a single scroll containing: nine identifying fields,
 * a milestones section that repeats a five-field block per milestone, and a
 * payments section that repeats another four. With three milestones and three
 * payments that is over forty inputs on one page, with the only Submit button
 * at the very bottom — so a validation failure in the first section was
 * reported a full screen and a half above where the reader was looking, and
 * nothing told them which section had the problem.
 *
 * Steps fix the specific failures, not the length:
 *
 *  - each step validates before it will let you leave it, so an error is
 *    reported next to the field that caused it while it is still on screen;
 *  - the step list is a table of contents, so the shape of the task is visible
 *    from the first screen rather than discovered by scrolling;
 *  - steps that do not apply — no milestones, no cost — are skipped entirely
 *    rather than shown as empty sections to scroll past.
 *
 * State lives in one form the whole way through, so nothing is lost moving
 * between steps and the final submit sends exactly what a single-page form
 * would have sent.
 */

export interface WizardStep {
  id: string;
  label: string;
  /** One line under the heading saying what this step is for. */
  description?: string;
  /**
   * The fields this step owns. Leaving the step validates exactly these, so a
   * milestone error cannot block the basics step and vice versa.
   */
  fields?: string[];
  /** Steps that do not apply drop out of the list rather than showing empty. */
  enabled?: boolean;
  /** Marks the step optional in the list. */
  optional?: boolean;
}

export interface FormWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (index: number) => void;
  /**
   * Which steps have failed validation, by step id. Drawn on the step list so a
   * problem left behind is visible from anywhere in the form.
   */
  invalidSteps?: Set<string>;
  children: React.ReactNode;
  /** Rendered in the footer beside Back / Next — usually Cancel and Submit. */
  footer?: React.ReactNode;
  /** Called when Next is pressed. Return false to stay put. */
  onNext: () => Promise<boolean> | boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmit?: () => void;
  className?: string;
}

export function FormWizard({
  steps,
  currentStep,
  onStepChange,
  invalidSteps,
  children,
  footer,
  onNext,
  isSubmitting = false,
  submitLabel = 'Submit',
  onSubmit,
  className,
}: FormWizardProps) {
  const visible = steps.filter((s) => s.enabled !== false);
  const index = Math.min(currentStep, visible.length - 1);
  const step = visible[index];
  const isLast = index === visible.length - 1;

  const goNext = async () => {
    const ok = await onNext();
    if (ok && !isLast) onStepChange(index + 1);
  };

  return (
    <div className={cn('flex flex-col gap-6 lg:flex-row lg:gap-8', className)}>
      <div className="lg:w-[260px] lg:shrink-0">
        <div className="lg:sticky lg:top-20">
          <StepList
            steps={visible}
            currentIndex={index}
            invalidSteps={invalidSteps}
            onSelect={onStepChange}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            Step {index + 1} of {visible.length}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{step?.label}</h2>
          {step?.description && (
            <p className="text-sm text-muted-foreground">{step.description}</p>
          )}
        </div>

        {/* Announced when the step changes: the heading above is new content
            that appeared without focus moving anywhere. */}
        <div aria-live="polite" className="sr-only">
          Step {index + 1} of {visible.length}: {step?.label}
        </div>

        {children}

        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onStepChange(index - 1)}
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </Button>
            )}
            {footer}
          </div>

          <div className="flex items-center gap-2">
            {isLast ? (
              <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : submitLabel}
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={isSubmitting}>
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The steps, as a list you can also navigate with.
 *
 * Every step is reachable at any time rather than only forwards. Someone
 * editing an existing project wants to change one field on step three, and
 * making them walk through two steps of already-valid data to reach it is the
 * kind of thing that gets a form abandoned.
 */
function StepList({
  steps,
  currentIndex,
  invalidSteps,
  onSelect,
}: {
  steps: WizardStep[];
  currentIndex: number;
  invalidSteps?: Set<string>;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Form steps">
      <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isDone = i < currentIndex;
          const isInvalid = invalidSteps?.has(step.id) ?? false;

          return (
            <li key={step.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isCurrent
                    ? 'bg-secondary font-medium text-secondary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                    isInvalid
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : isDone
                        ? 'border-green-700 bg-green-700 text-white'
                        : isCurrent
                          ? 'border-foreground text-foreground'
                          : 'border-border',
                  )}
                >
                  {isInvalid ? (
                    <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : isDone ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{step.label}</span>
                  {step.optional && (
                    <span className="block text-xs font-normal text-muted-foreground">Optional</span>
                  )}
                  {isInvalid && (
                    <span className="block text-xs font-normal text-destructive">
                      Needs attention
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * A group of fields inside a step, with a heading.
 *
 * Used where a step still has two distinct clusters — timing and ownership, for
 * instance — so the step stays scannable without becoming another page.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
