
"use client";

import { useEffect } from "react";
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
import type { Blocker } from "@/lib/types";

type EditBlockerDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  blocker: Blocker;
  onBlockerUpdate: (blockerId: string, description: string) => void;
};

const blockerSchema = z.object({
  description: z.string().min(10, "Blocker description must be at least 10 characters."),
});

type BlockerFormValues = z.infer<typeof blockerSchema>;

export function EditBlockerDialog({ isOpen, onOpenChange, blocker, onBlockerUpdate }: EditBlockerDialogProps) {
  const form = useForm<BlockerFormValues>({
    resolver: zodResolver(blockerSchema),
  });

  useEffect(() => {
    if (blocker) {
      form.reset({
        description: blocker.description,
      });
    }
  }, [blocker, form]);

  function onSubmit(data: BlockerFormValues) {
    onBlockerUpdate(blocker.id, data.description);
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Blocker</DialogTitle>
          <DialogDescription>
            Update the description for this blocker.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blocker Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Awaiting security clearance for server access..."
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
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
