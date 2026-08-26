"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { escalateBlockerSchema, type EscalateBlockerInput } from "@/lib/validation/blocker";
import type { Blocker } from "@/lib/types";
import type { OwnerOption } from "./blocker-form-fields";

type EscalateBlockerDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  blocker: Blocker;
  onEscalate: (blockerId: string, values: EscalateBlockerInput) => void;
  recipients: OwnerOption[];
};

/**
 * Escalation as a recorded act.
 *
 * Raising something to a sponsor previously happened in a meeting or an email
 * and left no trace on the project, so nobody could later say when it had been
 * raised or to whom. Both are required here.
 */
export function EscalateBlockerDialog({
  isOpen,
  onOpenChange,
  blocker,
  onEscalate,
  recipients,
}: EscalateBlockerDialogProps) {
  const form = useForm<EscalateBlockerInput>({
    resolver: zodResolver(escalateBlockerSchema),
    defaultValues: { escalatedToId: "", escalationReason: "" },
  });

  function onSubmit(data: EscalateBlockerInput) {
    onEscalate(blocker.id, data);
    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escalate this issue</DialogTitle>
          <DialogDescription>
            &ldquo;{blocker.title}&rdquo; will be marked as escalated, and the person you choose
            will be notified.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="escalatedToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escalate to</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Who can clear this?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {recipients.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="escalationReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Why does this need escalating?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. The vendor has missed two agreed dates and UAT cannot start without the keys."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Kept on the record, so the history survives the meeting.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Escalate</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
