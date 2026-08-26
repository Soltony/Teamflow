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
                        <h4 className="font-medium">Payment Schedule</h4>
                        <p className="text-sm text-muted-foreground">Define the payment items for this project. The sum must equal the total project cost.</p>
                    </div>

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
