
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { approvePayment, rejectPayment } from "@/app/payment-approvals/actions";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
// Derived from the action that fills this list. Restating the Prisma row
// here declared `amount` as a Decimal and the dates as Dates, when what
// arrives is a decimal string and ISO strings.
import type { getPendingPayments } from '@/app/payment-approvals/actions';

type PendingPaymentWithRelations = Awaited<ReturnType<typeof getPendingPayments>>[number];

type PaymentApprovalManagementProps = {
  initialPayments: PendingPaymentWithRelations[];
  onDataChange: () => void;
};

const rejectionSchema = z.object({
  notes: z.string().min(10, "A reason of at least 10 characters is required."),
});

type RejectionFormValues = z.infer<typeof rejectionSchema>;

export function PaymentApprovalManagement({ initialPayments, onDataChange }: PaymentApprovalManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [paymentToReject, setPaymentToReject] = useState<PendingPaymentWithRelations | null>(null);
  const { hasPermission } = useAuth();
  
  const canManage = hasPermission('payment-approvals:manage');

  const form = useForm<RejectionFormValues>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { notes: "" },
  });

  function handleApprove(paymentId: string) {
    startTransition(async () => {
      const result = await approvePayment(paymentId, "Approved");
      if (result.success) {
        toast({ title: "Payment Approved!", description: "The payment has been successfully approved." });
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }
  
  function handleOpenRejectDialog(payment: PendingPaymentWithRelations) {
    form.reset();
    setPaymentToReject(payment);
  }

  function handleRejectSubmit(data: RejectionFormValues) {
    if (!paymentToReject) return;
    startTransition(async () => {
      const result = await rejectPayment(paymentToReject.id, data.notes);
      if (result.success) {
        toast({ title: "Payment Rejected!", description: "The payment has been rejected and the submitter notified.", variant: "destructive" });
        setPaymentToReject(null);
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <>
      <Table scrollLabel="Payments awaiting approval">
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Payment Title</TableHead>
            <TableHead>Date Requested</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialPayments.length > 0 ? (
            initialPayments.map(payment => {
              const currencySymbol = payment.project.currency === 'USD' ? '$' : 'ETB';
              return (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.project.name}</TableCell>
                  <TableCell>{payment.title}</TableCell>
                  <TableCell>{format(new Date(payment.createdAt), 'MMM dd, yyyy')}</TableCell>
                  <TableCell className="text-right font-semibold">{currencySymbol} {parseFloat(payment.amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleOpenRejectDialog(payment)} disabled={isPending}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => handleApprove(payment.id)} disabled={isPending}>
                          Approve
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No pending payments found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      
      <Dialog open={!!paymentToReject} onOpenChange={() => setPaymentToReject(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Payment</DialogTitle>
                <DialogDescription>
                    Provide a reason for rejecting this payment. This will be visible to the original submitter.
                </DialogDescription>
            </DialogHeader>
             <Form {...form}>
              <form id="rejection-form" onSubmit={form.handleSubmit(handleRejectSubmit)} className="space-y-4 py-4">
                 <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Reason for Rejection</FormLabel>
                        <FormControl>
                        <Textarea
                            placeholder="e.g., The invoice provided does not match the amount requested."
                            className="min-h-[120px]"
                            {...field}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </form>
            </Form>
            <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentToReject(null)}>Cancel</Button>
                <Button type="submit" form="rejection-form" variant="destructive" disabled={isPending}>
                    {isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
