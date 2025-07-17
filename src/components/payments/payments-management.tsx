
"use client";

import * as React from "react";
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
import { Input } from "@/components/ui/input";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { addMilestonePayment } from "@/app/payments/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock, CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "../ui/badge";

type MilestoneWithPayments = any;
type ProjectWithRelations = any;

type PaymentsManagementProps = {
  initialProjects: ProjectWithRelations[];
  onDataChange: () => void;
};

const paymentSchema = (maxAmount: number) => z.object({
  amount: z.coerce.number().positive("Amount must be positive.").max(maxAmount, `Amount cannot exceed the remaining balance of ${maxAmount.toFixed(2)}.`),
  paymentDate: z.date({ required_error: "A payment date is required." }),
});

export function PaymentsManagement({ initialProjects, onDataChange }: PaymentsManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithPayments | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const approvedPaymentsForMilestone = selectedMilestone?.payments.filter((p: any) => p.status === 'APPROVED') || [];
  const totalPaid = approvedPaymentsForMilestone.reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0);
  
  const remainingBalance = selectedMilestone
    ? parseFloat(selectedMilestone.cost.toString()) - totalPaid
    : 0;

  const form = useForm<z.infer<ReturnType<typeof paymentSchema>>>({
    resolver: zodResolver(paymentSchema(remainingBalance)),
    defaultValues: {
      paymentDate: new Date(),
      amount: 0,
    },
  });

  function handleRecordPayment(milestone: MilestoneWithPayments) {
    const approvedPayments = milestone.payments.filter((p: any) => p.status === 'APPROVED');
    const currentlyPaid = approvedPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0);
    const balance = parseFloat(milestone.cost.toString()) - currentlyPaid;
    form.reset({ paymentDate: new Date(), amount: balance });
    setSelectedMilestone(milestone);
  }

  function onSubmit(data: z.infer<ReturnType<typeof paymentSchema>>) {
    if (!selectedMilestone) return;

    startTransition(async () => {
      const result = await addMilestonePayment(selectedMilestone.id, data.amount, data.paymentDate);
      if (result.success) {
        toast({
          title: "Payment Submitted!",
          description: `Your payment of ${data.amount.toFixed(2)} has been submitted for approval.`,
        });
        setSelectedMilestone(null);
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'PENDING':
            return <Badge variant="secondary" className="bg-amber-500/80 text-white"><Clock className="mr-1 h-3 w-3"/>Pending</Badge>;
        case 'APPROVED':
            return <Badge variant="secondary" className="bg-green-600 text-white"><CheckCircle className="mr-1 h-3 w-3"/>Approved</Badge>;
        case 'REJECTED':
            return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3"/>Rejected</Badge>;
        default:
            return <Badge variant="outline">Unknown</Badge>;
    }
  }

  const toggleRow = (milestoneId: string) => {
    setExpandedRows(prev => ({ ...prev, [milestoneId]: !prev[milestoneId] }));
  };

  return (
    <>
      <Accordion type="multiple" className="w-full space-y-4" defaultValue={initialProjects.map((p: any) => p.id)}>
        {initialProjects.map((project: ProjectWithRelations) => (
          <AccordionItem value={project.id} key={project.id} className="border rounded-lg bg-background">
            <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
              {project.name}
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-center">Latest Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.milestones.filter((m: any) => m.cost > 0).map((milestone: MilestoneWithPayments) => {
                    const allPayments = milestone.payments || [];
                    const approvedPayments = allPayments.filter((p: any) => p.status === 'APPROVED');
                    const totalPaid = approvedPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0);
                    const milestoneCost = parseFloat(milestone.cost.toString());
                    const balance = milestoneCost - totalPaid;
                    const hasPendingPayment = allPayments.some((p: any) => p.status === 'PENDING');
                    const isExpanded = expandedRows[milestone.id];

                    const latestPayment = allPayments.length > 0 
                      ? [...allPayments].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                      : null;

                    return (
                      <React.Fragment key={milestone.id}>
                        <TableRow>
                          <TableCell className="p-2">
                            {allPayments.length > 0 && (
                              <Button variant="ghost" size="icon" onClick={() => toggleRow(milestone.id)} className="h-8 w-8">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{milestone.title}</TableCell>
                          <TableCell className="text-right">${milestoneCost.toFixed(2)}</TableCell>
                          <TableCell className="text-right">${totalPaid.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">${balance.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                              {latestPayment ? getStatusBadge(latestPayment.status) : <Badge variant="outline">Not Started</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            {balance > 0 && !hasPendingPayment && (
                              <Button size="sm" onClick={() => handleRecordPayment(milestone)}>
                                Record Payment
                              </Button>
                            )}
                            {hasPendingPayment && (
                              <Badge variant="outline">Approval Pending</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && allPayments.length > 0 && (
                           <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                    <div className="p-4 bg-muted/50">
                                        <h4 className="font-semibold mb-2 text-sm">Payment History</h4>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Payment Date</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                    <TableHead>Notes / Reason</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {allPayments.sort((a:any,b:any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((payment: any) => (
                                                    <TableRow key={payment.id} className="bg-background">
                                                        <TableCell>{format(new Date(payment.paymentDate), 'MMM dd, yyyy')}</TableCell>
                                                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                                                        <TableCell className="text-right">${parseFloat(payment.amount.toString()).toFixed(2)}</TableCell>
                                                        <TableCell>{payment.notes}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TableCell>
                           </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Dialog open={!!selectedMilestone} onOpenChange={(open) => !open && setSelectedMilestone(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Payment for "{selectedMilestone?.title}"</DialogTitle>
            <DialogDescription>
                Enter the payment details. The amount cannot exceed the remaining balance of ${remainingBalance.toFixed(2)}. This will be sent for approval.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Payment Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelectedMilestone(null)} disabled={isPending}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Submitting..." : "Submit for Approval"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
