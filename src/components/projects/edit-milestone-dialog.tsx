
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
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { Milestone, Department } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo } from "react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EditMilestoneDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: Milestone;
  projectMilestones: Milestone[];
  departments: Department[];
  onMilestoneUpdate: (updatedMilestone: Milestone) => Promise<void>;
};

export function EditMilestoneDialog({ isOpen, onOpenChange, milestone, projectMilestones, departments, onMilestoneUpdate }: EditMilestoneDialogProps) {

  const milestoneSchema = useMemo(() => {
    return z.object({
      title: z.string().min(3, "Title must be at least 3 characters."),
      description: z.string().min(10, "Description must be at least 10 characters."),
      dueDate: z.date(),
      weight: z.coerce.number().min(1, "Weight must be between 1 and 100.").max(100, "Weight must be between 1 and 100."),
      responsibleDepartmentIds: z.array(z.string()).nonempty({ message: "At least one department must be responsible." }),
    }).superRefine((data, ctx) => {
        const weightOfOtherMilestones = projectMilestones
          .filter(m => m.id !== milestone.id)
          .reduce((sum, m) => sum + m.weight, 0);
        const newTotalWeight = weightOfOtherMilestones + data.weight;

        if (newTotalWeight > 100) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `The sum of all milestone weights cannot exceed 100. With this change, the total would be ${newTotalWeight}%.`,
                path: ['weight']
            });
        }
    });
  }, [projectMilestones, milestone.id]);


  type MilestoneFormValues = z.infer<typeof milestoneSchema>;

  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneSchema),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: milestone.title,
        description: milestone.description,
        dueDate: parseISO(milestone.dueDate),
        weight: milestone.weight,
        responsibleDepartmentIds: milestone.responsibleDepartmentIds,
      });
    }
  }, [isOpen, milestone, form]);

  async function onSubmit(data: MilestoneFormValues) {
    const updatedMilestone = {
      ...milestone,
      ...data,
      dueDate: data.dueDate.toISOString(),
    };
    await onMilestoneUpdate(updatedMilestone as Milestone);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Milestone</DialogTitle>
          <DialogDescription>Make changes to your milestone here. The total weight of all milestones must equal 100%.</DialogDescription>
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
            <FormField
                control={form.control}
                name="responsibleDepartmentIds"
                render={({ field }) => {
                    const selectedDepts = departments.filter(dept => field.value?.includes(dept.id));
                    return (
                    <FormItem className="flex flex-col">
                        <FormLabel>Responsible Departments</FormLabel>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <FormControl>
                            <Button variant="outline" className={cn("w-full justify-start", !field.value?.length && "text-muted-foreground")}>
                                {selectedDepts.length > 0
                                    ? selectedDepts.map(d => d.name).join(', ')
                                    : "Select departments..."}
                                <ChevronDown className="ml-auto h-4 w-4" />
                            </Button>
                            </FormControl>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                            {departments.map((dept) => (
                            <DropdownMenuCheckboxItem
                                key={dept.id}
                                checked={field.value?.includes(dept.id)}
                                onCheckedChange={(checked) => {
                                const newValues = field.value ? [...field.value] : [];
                                if (checked) {
                                    newValues.push(dept.id);
                                } else {
                                    const idx = newValues.indexOf(dept.id);
                                    if (idx > -1) newValues.splice(idx, 1);
                                }
                                field.onChange(newValues);
                                }}
                            >
                                {dept.name}
                            </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                        </DropdownMenu>
                        <FormMessage />
                    </FormItem>
                    )
                }}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
