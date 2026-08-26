"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { DataToolbar, ALL } from "@/components/ui/data-toolbar";
import { RejectDialog, RowReason } from "@/components/ui/approval-queue";
import { useToast } from "@/hooks/use-toast";
import { approvePayment, rejectPayment } from "@/app/payment-approvals/actions";
import { useAuth } from "@/context/auth-context";
// Derived from the action that fills this list. Restating the Prisma row
// here declared `amount` as a Decimal and the dates as Dates, when what
// arrives is a decimal string and ISO strings.
import type { getPendingPayments } from '@/app/payment-approvals/actions';

type PendingPaymentWithRelations = Awaited<ReturnType<typeof getPendingPayments>>[number];

type PaymentApprovalManagementProps = {
  initialPayments: PendingPaymentWithRelations[];
  onDataChange: () => void;
};

const SORT_OPTIONS = [
  { value: 'amount', label: 'Largest amount first' },
  { value: 'oldest', label: 'Longest waiting first' },
  { value: 'project', label: 'Project, A to Z' },
];

const symbolFor = (currency?: string | null) => (currency === 'USD' ? '$' : 'ETB');

const amountOf = (payment: PendingPaymentWithRelations) =>
  parseFloat(String(payment.amount ?? 0)) || 0;

const money = (amount: number, currency?: string | null) =>
  `${symbolFor(currency)} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Payments waiting to be released.
 *
 * The queue this replaces listed a project, a title, a date and an amount, and
 * offered Approve and Reject. Two things were missing and both are money
 * questions: nothing said what the payment represents as a share of the
 * project's budget, and nothing totalled the queue — so an approver could not
 * see that the six rows in front of them came to eleven million birr.
 *
 * There is no bulk approve here, deliberately. Releasing money one row at a
 * time is the point.
 */
export function PaymentApprovalManagement({ initialPayments, onDataChange }: PaymentApprovalManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [paymentToReject, setPaymentToReject] = useState<PendingPaymentWithRelations | null>(null);
  const { hasPermission } = useAuth();

  const canManage = hasPermission('payment-approvals:manage');

  const [search, setSearch] = useState('');
  const [project, setProject] = useState<string>(ALL);
  const [sort, setSort] = useState('amount');

  const projectOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const payment of initialPayments) {
      if (payment.project) seen.set(payment.project.id, payment.project.name);
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [initialPayments]);

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = initialPayments.filter((payment) => {
      if (project !== ALL && payment.project?.id !== project) return false;
      if (!query) return true;
      return (
        String(payment.title ?? '').toLowerCase().includes(query) ||
        String(payment.project?.name ?? '').toLowerCase().includes(query) ||
        String(payment.description ?? '').toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'amount') return amountOf(b) - amountOf(a);
      if (sort === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return String(a.project?.name ?? '').localeCompare(String(b.project?.name ?? ''));
    });
  }, [initialPayments, search, project, sort]);

  /**
   * The total in front of the approver.
   *
   * Only meaningful when the rows share a currency, so it is suppressed rather
   * than adding dollars to birr and presenting the result as a number.
   */
  const total = React.useMemo(() => {
    const currencies = new Set(visible.map((p) => p.project?.currency ?? 'ETB'));
    if (currencies.size !== 1) return null;
    return {
      amount: visible.reduce((sum, p) => sum + amountOf(p), 0),
      currency: [...currencies][0],
    };
  }, [visible]);

  function handleApprove(paymentId: string) {
    startTransition(async () => {
      const result = await approvePayment(paymentId, "Approved");
      if (result.success) {
        toast({ title: "Payment approved", description: "It has been released for processing." });
        onDataChange();
      } else {
        toast({ title: "That did not work", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleRejectSubmit(notes: string) {
    if (!paymentToReject) return;
    startTransition(async () => {
      const result = await rejectPayment(paymentToReject.id, notes);
      if (result.success) {
        toast({
          title: "Payment refused",
          description: "Nothing has been released, and the submitter has your reason.",
        });
        setPaymentToReject(null);
        onDataChange();
      } else {
        toast({ title: "That did not work", description: result.error, variant: "destructive" });
      }
    });
  }

  if (initialPayments.length === 0) {
    return (
      <EmptyState
        variant="none-yours"
        icon={CheckCircle2}
        title="No payments are waiting"
        description="Nothing has been submitted for release. Scheduled payments appear here when they are raised."
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        <DataToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search payments or projects…',
            label: 'Search payments awaiting approval',
          }}
          filters={[
            {
              id: 'project',
              label: 'Project',
              value: project,
              onChange: setProject,
              options: projectOptions,
              allLabel: 'All projects',
            },
          ]}
          sort={{ value: sort, onChange: setSort, options: SORT_OPTIONS }}
          count={{ showing: visible.length, total: initialPayments.length, noun: 'payments' }}
          onClearAll={() => {
            setSearch('');
            setProject(ALL);
          }}
        />

        {visible.length === 0 ? (
          <EmptyState
            variant="no-match"
            title="No payments match"
            description="There are payments waiting — none of them fit the filters you have set."
            compact
          />
        ) : (
          <Table scrollLabel="Payments awaiting approval">
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Share of budget</TableHead>
                {canManage && <TableHead className="text-right">Decision</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((payment) => {
                const amount = amountOf(payment);
                const budget = parseFloat(String(payment.project?.totalCost ?? 0)) || 0;
                const share = budget > 0 ? (amount / budget) * 100 : null;

                return (
                  <TableRow key={payment.id}>
                    <TableCell className="max-w-[200px] font-medium">
                      <Link
                        href={`/projects/${payment.project.id}`}
                        className="block truncate rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {payment.project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <span className="block truncate font-medium">{payment.title}</span>
                      {payment.description && (
                        <RowReason>
                          <span className="line-clamp-1">{payment.description}</span>
                        </RowReason>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(payment.createdAt), 'd MMM yyyy')}
                      <RowReason>
                        {formatDistanceToNow(new Date(payment.createdAt), { addSuffix: true })}
                      </RowReason>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {money(amount, payment.project?.currency)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {share === null ? '—' : `${share.toFixed(1)}%`}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPaymentToReject(payment)}
                            disabled={isPending}
                          >
                            Refuse
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(payment.id)}
                            disabled={isPending}
                          >
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
            {total && visible.length > 1 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>
                    Total awaiting release{visible.length < initialPayments.length ? ' (filtered)' : ''}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {money(total.amount, total.currency)}
                  </TableCell>
                  <TableCell colSpan={canManage ? 2 : 1} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        )}
      </div>

      <RejectDialog
        open={!!paymentToReject}
        onOpenChange={(open) => !open && setPaymentToReject(null)}
        title="Refuse this payment?"
        subject={
          paymentToReject && (
            <>
              <p className="font-medium">{paymentToReject.title}</p>
              <p className="text-muted-foreground">
                {paymentToReject.project.name} ·{' '}
                {money(amountOf(paymentToReject), paymentToReject.project?.currency)}
              </p>
            </>
          )
        }
        consequence="No money is released. The payment stays on the project's schedule and your reason goes back to whoever raised it."
        placeholder="e.g. The supporting invoice does not match the amount requested."
        isPending={isPending}
        onConfirm={handleRejectSubmit}
        confirmLabel="Refuse the payment"
      />
    </>
  );
}
