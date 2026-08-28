'use client';

import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import type { Department, PmoDivision, ProjectStatus } from '@prisma/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { checkWeights } from '@/lib/metrics';
import type { Serialized } from '@/lib/serialize';
import type { UserWithRoles } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { ProjectFormValues } from './project-form-schema';

/**
 * The last step: everything you are about to submit, in one place.
 *
 * A long form gives no opportunity to check the whole before committing it —
 * by the time you reach Submit the first fields are two screens above you.
 * That mattered here because two of this form's rules are arithmetic across
 * repeated blocks: milestone weights must total exactly 100, and the payment
 * schedule must total exactly the project cost. Both were previously discovered
 * by submitting and being refused.
 *
 * Every row links back to the step that owns it, so fixing something found here
 * is one click rather than a hunt.
 */

export function ProjectReviewStep({
  form,
  mode,
  pmoDivisions,
  departments,
  projectStatuses,
  users,
  currencySymbol,
  onEditStep,
}: {
  form: UseFormReturn<ProjectFormValues>;
  mode: 'create' | 'edit';
  pmoDivisions: Serialized<PmoDivision>[];
  departments: Serialized<Department>[];
  projectStatuses: Serialized<ProjectStatus>[];
  users: UserWithRoles[];
  currencySymbol: string;
  onEditStep: (stepId: string) => void;
}) {
  const values = form.watch();

  const division = pmoDivisions.find((d) => d.id === values.pmoDivisionId);
  const manager = users.find((u) => u.id === values.projectManagerId);
  const status = projectStatuses.find((s) => s.id === values.statusId);
  const depts = departments.filter((d) => values.responsibleDepartmentIds?.includes(d.id));
  const participants = pmoDivisions.filter((d) => values.participatingDivisionIds?.includes(d.id));

  const milestones = values.hasMilestones ? values.milestones ?? [] : [];
  const weights = checkWeights(milestones.map((m) => m.weight));

  const payments = values.hasCost ? values.payments ?? [] : [];
  const paymentTotal = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const costMatches = !values.hasCost || payments.length === 0 || paymentTotal === Number(values.totalCost ?? 0);

  const money = (amount: number) =>
    `${currencySymbol} ${new Intl.NumberFormat('en-US').format(amount)}`;

  return (
    <div className="space-y-4">
      <ReviewCard title="Basics" onEdit={() => onEditStep('basics')}>
        <Row label="Name" value={values.name || <Missing />} />
        <Row label="Delivers" value={values.description || <Missing />} />
        <Row label="Status" value={status?.name ?? <Missing />} />
      </ReviewCard>

      <ReviewCard title="Schedule" onEdit={() => onEditStep('schedule')}>
        <Row
          label="Runs"
          value={
            values.startDate && values.endDate ? (
              `${format(values.startDate, 'd MMM yyyy')} – ${format(values.endDate, 'd MMM yyyy')}`
            ) : (
              <Missing />
            )
          }
        />
        <Row label="Working year" value={values.workingYear || <Missing />} />
      </ReviewCard>

      <ReviewCard title="Structure" onEdit={() => onEditStep('structure')}>
        {!values.hasMilestones ? (
          <p className="text-sm text-muted-foreground">
            No milestones. Progress cannot be tracked against a plan until the work is broken down.
          </p>
        ) : milestones.length === 0 ? (
          <Check ok={false} message="Milestones are switched on but none have been added." />
        ) : (
          <>
            <ul className="space-y-1.5">
              {milestones.map((m, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{m.title || <Missing />}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {m.dueDate ? format(m.dueDate, 'd MMM yy') : '—'} · {m.weight}%
                  </span>
                </li>
              ))}
            </ul>
            <Check
              ok={weights.isComplete}
              message={
                weights.isComplete
                  ? `Weights total 100%, as required.`
                  : `Weights total ${weights.total}%. They must total exactly 100% — ${
                      weights.remaining > 0
                        ? `${weights.remaining}% is unallocated.`
                        : `${Math.abs(weights.remaining)}% over.`
                    }`
              }
            />
          </>
        )}
      </ReviewCard>

      <ReviewCard title="Budget" onEdit={() => onEditStep('budget')}>
        {!values.hasCost ? (
          <p className="text-sm text-muted-foreground">No budget recorded for this project.</p>
        ) : (
          <>
            <Row label="Total cost" value={money(Number(values.totalCost ?? 0))} />
            {payments.length > 0 ? (
              <>
                <ul className="space-y-1.5">
                  {payments.map((p, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{p.title || <Missing />}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {p.paymentDate ? format(p.paymentDate, 'd MMM yy') : '—'} ·{' '}
                        {money(Number(p.amount ?? 0))}
                      </span>
                    </li>
                  ))}
                </ul>
                <Check
                  ok={costMatches}
                  message={
                    costMatches
                      ? `The ${payments.length} scheduled payment${payments.length === 1 ? '' : 's'} total the project cost.`
                      : `Payments total ${money(paymentTotal)}, which does not match the project cost of ${money(Number(values.totalCost ?? 0))}.`
                  }
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No payment schedule set.</p>
            )}
          </>
        )}
      </ReviewCard>

      <ReviewCard title="Team" onEdit={() => onEditStep('team')}>
        <Row label="Owning EPMO division" value={division?.name ?? <Missing />} />
        <Row
          label="Participating divisions"
          // Not a Missing marker: no participants is the ordinary case, not an
          // omission to go back and fix.
          value={participants.length > 0 ? participants.map((d) => d.name).join(', ') : 'None'}
        />
        <Row label="Project manager" value={manager?.name ?? <Missing />} />
        <Row
          label="Responsible departments"
          value={depts.length > 0 ? depts.map((d) => d.name).join(', ') : <Missing />}
        />
      </ReviewCard>

      <p className="text-sm text-muted-foreground">
        {mode === 'edit'
          ? 'Saving applies these changes immediately. A changed end date is submitted for approval instead of taking effect straight away.'
          : 'Creating the project makes it visible to everyone with portfolio access, and it starts counting towards the working year’s figures.'}
      </p>
    </div>
  );
}

function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[minmax(0,180px)_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}

function Missing() {
  return <span className="font-normal italic text-muted-foreground">Not set</span>;
}

/** A rule that either holds or does not, stated plainly rather than as a stack trace. */
function Check({ ok, message }: { ok: boolean; message: string }) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-md border p-2.5 text-sm',
        ok
          ? 'border-success/30 bg-success-soft text-success-strong'
          : 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </p>
  );
}
