"use client";

import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
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
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProjectFormValues } from "./project-form-schema";
import { formatCurrency, unformatCurrency } from "./project-form-schema";

/**
 * Whether the payment schedule adds up to the project cost.
 *
 * Shown live rather than as a submit-time rejection, and it names the
 * shortfall: "ETB 40,000 left to schedule" is actionable in a way that "the
 * sum of payment items must equal the total project cost" is not.
 */
function PaymentTotal({
  form,
  currencySymbol,
  count,
}: {
  form: UseFormReturn<ProjectFormValues>;
  currencySymbol: string;
  count: number;
}) {
  const payments = form.watch("payments") ?? [];
  const totalCost = Number(form.watch("totalCost") ?? 0);
  const scheduled = payments.reduce((sum, p) => sum + Number(p?.amount ?? 0), 0);
  const difference = Math.round((totalCost - scheduled) * 100) / 100;
  const matches = difference === 0;

  const money = (amount: number) =>
    `${currencySymbol} ${new Intl.NumberFormat("en-US").format(amount)}`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-2 rounded-md border p-3 text-sm",
        matches
          ? "border-green-700/30 bg-green-700/10"
          : "border-amber-600/40 bg-amber-500/10",
      )}
    >
      <span className="font-medium">
        {count} payment{count === 1 ? "" : "s"} scheduled, {money(scheduled)} of {money(totalCost)}
      </span>
      <span className={cn("tabular-nums", matches ? "text-green-800" : "text-amber-800")}>
        {matches
          ? "Matches the project cost"
          : difference > 0
            ? `${money(difference)} left to schedule`
            : `${money(Math.abs(difference))} over budget`}
      </span>
    </div>
  );
}

/** The cost and payment-schedule half of the project form. */
export function ProjectFormCost({
  form,
  fieldArray,
  enabled,
  currencySymbol,
}: {
  form: UseFormReturn<ProjectFormValues>;
  fieldArray: UseFieldArrayReturn<ProjectFormValues, "payments">;
  enabled: boolean;
  currencySymbol: string;
}) {
  const { fields: paymentFields, append: appendPayment, remove: removePayment } = fieldArray;
  const hasCost = enabled;
  // The select binds to the code; the symbol is only for display.
  const currency = form.watch("currency");

  return (
    <>
         <div className="space-y-4">
            <FormField
                control={form.control}
                name="hasCost"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <FormLabel className="text-base">This project has a cost</FormLabel>
                    <FormDescription>
                        Enable to add financial tracking and define a payment schedule.
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
            {hasCost && (
                <div className="space-y-4 p-4 border rounded-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <FormField
                            control={form.control}
                            name="currency"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Currency</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a currency" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="ETB">ETB</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                         />
                         <FormField
                            control={form.control}
                            name="totalCost"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Total Project Cost</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">{currencySymbol}</span>
                                        <Input 
                                          type="text" 
                                          className={cn("pl-8", currency === 'ETB' && "pl-10")}
                                          placeholder="50,000"
                                          value={field.value === undefined ? '' : formatCurrency(String(field.value))}
                                          onChange={(e) => {
                                            const unformattedValue = unformatCurrency(e.target.value);
                                            const numberValue = parseFloat(unformattedValue);
                                            field.onChange(isNaN(numberValue) ? undefined : numberValue);
                                          }}
                                          onBlur={(e) => {
                                            const formatted = formatCurrency(e.target.value);
                                            e.target.value = formatted;
                                          }}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <Separator />
                    
                    <div>
                        <h4 className="font-medium">Payment schedule</h4>
                        <p className="text-sm text-muted-foreground">The scheduled payments must add up to exactly the total cost above.</p>
                    </div>

                    {/*
                      The running total. Same reasoning as the milestone weight
                      meter: the rule is arithmetic across repeated blocks, and
                      without this it could only be checked by adding the
                      amounts up by hand and submitting to find out.
                    */}
                    {paymentFields.length > 0 && (
                      <PaymentTotal form={form} currencySymbol={currencySymbol} count={paymentFields.length} />
                    )}

                     {paymentFields.map((field, index) => (
                        <Card key={field.id} className="relative bg-muted/50">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removePayment(index)}>
                                <X className="h-4 w-4" />
                            </Button>
                            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                     <FormField
                                        control={form.control}
                                        name={`payments.${index}.title`}
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Payment Title</FormLabel>
                                            <FormControl><Input placeholder="e.g., Initial Deposit" {...field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`payments.${index}.description`}
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Description (Optional)</FormLabel>
                                            <FormControl><Textarea placeholder="Payment for Phase 1 deliverables" {...field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                 <div className="space-y-4">
                                     <FormField
                                        control={form.control}
                                        name={`payments.${index}.amount`}
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                             <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">{currencySymbol}</span>
                                                    <Input 
                                                      type="text" 
                                                      className={cn("pl-8", currency === 'ETB' && "pl-10")}
                                                      placeholder="10,000" 
                                                      value={field.value === undefined ? '' : formatCurrency(String(field.value))}
                                                      onChange={(e) => {
                                                        const unformattedValue = unformatCurrency(e.target.value);
                                                        const numberValue = parseFloat(unformattedValue);
                                                        field.onChange(isNaN(numberValue) ? undefined : numberValue);
                                                      }}
                                                      onBlur={(e) => {
                                                        const formatted = formatCurrency(e.target.value);
                                                        e.target.value = formatted;
                                                      }}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`payments.${index}.paymentDate`}
                                        render={({ field: dateField }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Payment Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus /></PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                 </div>
                            </CardContent>
                        </Card>
                     ))}

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => appendPayment({ title: '', description: '', amount: 0, paymentDate: new Date() })}
                    >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Add Payment Item
                    </Button>
                </div>
            )}
         </div>

    </>
  );
}
