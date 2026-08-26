"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { Milestone } from "@/lib/types";
import { useEffect, useMemo } from "react";

type AddMilestoneDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectStartDate: string;
  projectEndDate: string;
  projectMilestones: Milestone[];
  onMilestoneAdd: (newMilestone: Omit<Milestone, 'id' | 'tasks'>) => Promise<void>;
};

export function AddMilestoneDialog({ isOpen, onOpenChange, projectStartDate, projectEndDate, projectMilestones, onMilestoneAdd }: AddMilestoneDialogProps) {

  const milestoneSchema = useMemo(() => {
    return z.object({
      title: z.string().min(3, "Title must be at least 3 characters."),
      description: z.string().min(10, "Description must be at least 10 characters."),
      startDate: z.date(),
      dueDate: z.date(),
      weight: z.coerce.number().min(1, "Weight must be between 1 and 100.").max(100, "Weight must be between 1 and 100."),
    }).refine(data => data.dueDate >= data.startDate, {
        message: "Due date must be on or after start date.",
        path: ["dueDate"],
    }).superRefine((data, ctx) => {
        const weightOfOtherMilestones = projectMilestones.reduce((sum, m) => sum + m.weight, 0);
        const newTotalWeight = weightOfOtherMilestones + data.weight;

        if (newTotalWeight > 100) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `The sum of all milestone weights cannot exceed 100. Current total is ${weightOfOtherMilestones}%.`,
                path: ['weight']
            });
        }

        if (data.startDate < parseISO(projectStartDate)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['startDate'],
                message: `Must be on or after project start: ${format(parseISO(projectStartDate), 'MMM d, yyyy')}.`
            });
        }
        if (data.dueDate > parseISO(projectEndDate)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['dueDate'],
                message: `Must be on or before project end date: ${format(parseISO(projectEndDate), 'MMM d, yyyy')}.`
            });
        }
    });
  }, [projectMilestones, projectStartDate, projectEndDate]);

  type MilestoneFormValues = z.infer<typeof milestoneSchema>;

  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      title: "",
      description: "",
      weight: 10,
    }
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: "",
        description: "",
        startDate: new Date(),
        dueDate: new Date(),
        weight: 10,
      });
    }
  }, [isOpen, form]);

  async function onSubmit(data: MilestoneFormValues) {
    const newMilestone = {
      ...data,
      startDate: data.startDate.toISOString(),
      dueDate: data.dueDate.toISOString(),
    };
    await onMilestoneAdd(newMilestone as Omit<Milestone, 'id' | 'tasks'>);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Milestone</DialogTitle>
          <DialogDescription>Fill in the details for the new milestone. The total weight of all milestones must equal 100%.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
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
                <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
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
            </div>
             <FormField
                control={form.control}
                name="weight"
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding..." : "Add Milestone"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
