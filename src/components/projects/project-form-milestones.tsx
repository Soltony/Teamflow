"use client";

import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ProjectFormValues } from "./project-form-schema";

/**
 * The milestones half of the project form.
 *
 * Split out of project-form.tsx, which had reached nearly nine hundred lines
 * holding three unrelated sections in one function. Nothing here is shared
 * with payments or with the core details, so nothing is gained by them sitting
 * together — and a change to the weight rules had to be made inside eight
 * hundred lines of unrelated markup.
 */
export function ProjectFormMilestones({
  form,
  fieldArray,
  enabled,
  weightError,
}: {
  form: UseFormReturn<ProjectFormValues>;
  fieldArray: UseFieldArrayReturn<ProjectFormValues, "milestones">;
  enabled: boolean;
  weightError?: { message?: string };
}) {
  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = fieldArray;
  const hasMilestones = enabled;
  const milestonesError = weightError;

  return (
    <>
        
        <div className="space-y-4">
             <FormField
                control={form.control}
                name="hasMilestones"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <FormLabel className="text-base">This project has milestones</FormLabel>
                    <FormDescription>
                        Enable to define the major milestones for this project.
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
            {hasMilestones && (
                <div className="space-y-4 p-4 border rounded-lg">
                    <div>
                        <h3 className="text-lg font-medium">Milestones</h3>
                        <p className="text-sm text-muted-foreground">Define the major milestones for this project. The sum of all milestone weights must equal 100%.</p>
                    </div>
                    {milestoneFields.map((field, index) => (
                    <Card key={field.id} className="relative">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeMilestone(index)}>
                            <X className="h-4 w-4" />
                        </Button>
                        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name={`milestones.${index}.title`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Milestone Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Q1 Goals" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name={`milestones.${index}.description`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Milestone Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Describe the milestone goals and deliverables." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name={`milestones.${index}.startDate`}
                                    render={({ field: dateField }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Start Date</FormLabel>
                                        <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}
                                            >
                                                {dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                                        </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`milestones.${index}.dueDate`}
                                    render={({ field: dateField }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Due Date</FormLabel>
                                        <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}
                                            >
                                                {dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                                        </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            
                            <FormField
                                control={form.control}
                                name={`milestones.${index}.weight`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Milestone Weight (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 25" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                                    </FormControl>
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
                        onClick={() => appendMilestone({ title: '', description: '', startDate: new Date(), dueDate: new Date(), weight: 20 })}
                    >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Add Milestone
                    </Button>
                    {milestonesError && (
                        <p className="text-sm font-medium text-destructive">{milestonesError.message}</p>
                    )}
                </div>
            )}
        </div>

    </>
  );
}
