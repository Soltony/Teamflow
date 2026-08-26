'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * The parts every approval queue shares.
 *
 * There were three of these — tasks, timeline changes, payments — built
 * independently and diverging in every way that matters:
 *
 *  - all three wrote their own identical rejection dialog, with three
 *    different placeholder texts and three copies of the same ten-character
 *    minimum;
 *  - none stated what approving would actually do, though the three
 *    consequences are wildly different: a task approval closes a task, a
 *    timeline approval moves a project's committed deadline, and a payment
 *    approval releases money;
 *  - an empty queue rendered as a table with one grey row saying "No pending
 *    payments found", which reads like a fault rather than the good news it is;
 *  - approving twelve tasks meant twelve round trips through the same two
 *    clicks, with no way to select and act on several at once.
 *
 * What is *not* shared is the table itself: the three queues genuinely show
 * different things, and forcing one column set on them would make each worse.
 */

const rejectionSchema = z.object({
  notes: z.string().trim().min(10, 'Give a reason of at least 10 characters.'),
});

export type RejectionFormValues = z.infer<typeof rejectionSchema>;

/**
 * Rejecting something, with the reason it needs.
 *
 * The reason is not paperwork: it is the only thing the submitter receives, so
 * the dialog says who will read it and what happens to their work afterwards.
 */
export function RejectDialog({
  open,
  onOpenChange,
  title,
  /** What the reader is rejecting, named. */
  subject,
  /** What rejecting does to it, and who is told. */
  consequence,
  placeholder,
  isPending,
  onConfirm,
  confirmLabel = 'Send it back',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subject?: React.ReactNode;
  consequence: string;
  placeholder: string;
  isPending?: boolean;
  onConfirm: (notes: string) => void;
  confirmLabel?: string;
}) {
  const form = useForm<RejectionFormValues>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { notes: '' },
  });

  // Reset on open rather than on close, so a reason typed for one row can
  // never be submitted against the next.
  React.useEffect(() => {
    if (open) form.reset({ notes: '' });
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{consequence}</DialogDescription>
        </DialogHeader>

        {subject && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">{subject}</div>
        )}

        <Form {...form}>
          <form
            id="rejection-form"
            onSubmit={form.handleSubmit((data) => onConfirm(data.notes))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea placeholder={placeholder} className="min-h-[110px]" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is what the submitter sees. Say what needs to change, not just that it was
                    refused.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="rejection-form" variant="destructive" disabled={isPending}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {isPending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirming a batch decision.
 *
 * Bulk approval is the one place in these queues where a mis-click is
 * expensive, so it is the one place that asks. Single approvals do not — one
 * row, one visible decision, and a confirmation on each would make the queue
 * twice as slow for no protection.
 */
export function BulkApproveDialog({
  open,
  onOpenChange,
  count,
  noun,
  consequence,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  consequence: string;
  isPending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Approve {count} {count === 1 ? noun : `${noun}s`}?
          </DialogTitle>
          <DialogDescription>{consequence}</DialogDescription>
        </DialogHeader>
        <p className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span>This happens to all {count} at once and cannot be undone from here.</span>
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {isPending ? 'Working…' : `Approve all ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The select-all header cell for a queue table.
 *
 * Indeterminate when some but not all rows are selected — without it, a
 * half-selected list shows an unchecked box, and clicking it selects
 * everything when the reader expected it to clear.
 */
export function SelectAllHead({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <TableHead className="w-10">
      <Checkbox
        checked={indeterminate ? 'indeterminate' : checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-label={label}
      />
    </TableHead>
  );
}

export function SelectRowCell({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <TableCell className="w-10">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-label={label}
      />
    </TableCell>
  );
}

/**
 * Tracks which rows are selected, kept honest as the list changes.
 *
 * The pruning matters: after a bulk approve the approved rows leave the queue,
 * and a selection still holding their ids would show "4 selected" over a list
 * of two.
 */
export function useRowSelection<T extends { id: string }>(rows: T[]) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const ids = React.useMemo(() => rows.map((r) => r.id).join(','), [rows]);
  React.useEffect(() => {
    setSelected((current) => {
      const live = new Set(ids ? ids.split(',') : []);
      const next = new Set([...current].filter((id) => live.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [ids]);

  const toggle = React.useCallback((id: string, on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(
    (on: boolean) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set()),
    [rows],
  );

  const clear = React.useCallback(() => setSelected(new Set()), []);

  return {
    selected,
    count: selected.size,
    isSelected: (id: string) => selected.has(id),
    allSelected: rows.length > 0 && selected.size === rows.length,
    someSelected: selected.size > 0 && selected.size < rows.length,
    toggle,
    toggleAll,
    clear,
  };
}

/** A row's "why this is here" line, kept to one sentence under the main cell. */
export function RowReason({ children, tone }: { children: React.ReactNode; tone?: 'urgent' }) {
  return (
    <p className={cn('text-xs', tone === 'urgent' ? 'text-destructive' : 'text-muted-foreground')}>
      {children}
    </p>
  );
}
