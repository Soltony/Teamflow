
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
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type MilestoneWithPayments = any;
type ProjectWithRelations = any;

const paymentSchema = (maxAmount: number) => z.object({
  amount: z.coerce.number().positive("Amount must be positive.").max(maxAmount, `Amount cannot exceed the remaining balance of ${maxAmount.toFixed(2)}.`),
  paymentDate: z.date({ required_error: "A payment date is required." }),
});

export function PaymentsManagement({ initialProjects }: { initialProjects: ProjectWithRelations[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithPayments | null>(null);

  const remainingBalance = selectedMilestone
    ? parseFloat(selectedMilestone.cost.toString()) - selectedMilestone.payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0)
    : 0;

  const form = useForm<z.infer<ReturnType<typeof paymentSchema>>>({
    resolver: zodResolver(paymentSchema(remainingBalance)),
    defaultValues: {
      paymentDate: new Date(),
      amount: 0,
    },
  });

  function handleRecordPayment(milestone: MilestoneWithPayments) {
    const balance = parseFloat(milestone.cost.toString()) - milestone.payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0);
    form.reset({ paymentDate: new Date(), amount: balance });
    setSelectedMilestone(milestone);
  }

  function onSubmit(data: z.infer<ReturnType<typeof paymentSchema>>) {
    if (!selectedMilestone) return;

    startTransition(async () => {
      const result = await addMilestonePayment(selectedMilestone.id, data.amount, data.paymentDate);
      if (result.success) {
        toast({
          title: "Payment Recorded!",
          description: `A payment of ${data.amount.toFixed(2)} has been recorded for milestone "${selectedMilestone.title}".`,
        });
        setSelectedMilestone(null);
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

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
                    <TableHead>Milestone</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.milestones.filter((m: any) => m.cost > 0).map((milestone: MilestoneWithPayments) => {
                    const totalPaid = milestone.payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0);
                    const milestoneCost = parseFloat(milestone.cost.toString());
                    const balance = milestoneCost - totalPaid;
                    return (
                      <TableRow key={milestone.id}>
                        <TableCell className="font-medium">{milestone.title}</TableCell>
                        <TableCell className="text-right">${milestoneCost.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${totalPaid.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">${balance.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {balance > 0 && (
                            <Button size="sm" onClick={() => handleRecordPayment(milestone)}>
                              Record Payment
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
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
            <DialogTitle>Record Payment for "{selectedMilestone?.title}"</DialogTitle>
            <DialogDescription>
                Enter the payment details. The amount cannot exceed the remaining balance of ${remainingBalance.toFixed(2)}.
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
                  {isPending ? "Saving..." : "Save Payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
