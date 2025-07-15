
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
import { Textarea } from "@/components/ui/textarea";
import type { TeamViewTask } from "@/app/team-view/page";

type DeclineTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  task: TeamViewTask;
  onDeclineConfirm: (reason: string) => void;
};

const declineSchema = z.object({
  reason: z.string().min(10, "A reason for declining (at least 10 characters) is required."),
});

type DeclineFormValues = z.infer<typeof declineSchema>;

export function DeclineTaskDialog({ isOpen, onOpenChange, task, onDeclineConfirm }: DeclineTaskDialogProps) {
  const form = useForm<DeclineFormValues>({
    resolver: zodResolver(declineSchema),
    defaultValues: {
      reason: "",
    },
  });

  function onSubmit(data: DeclineFormValues) {
    onDeclineConfirm(data.reason);
    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decline Task: {task.title}</DialogTitle>
          <DialogDescription>
            Please provide a reason for declining this task. The reason will be added as a comment for the assignee.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Declining</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., The feature is missing responsive styles for mobile devices."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="destructive">Decline Task</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
