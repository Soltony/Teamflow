
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
import type { Blocker } from "@/lib/types";

type AddBlockerDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onBlockerAdd: (blocker: Omit<Blocker, 'id' | 'createdAt' | 'status'>) => void;
};

const blockerSchema = z.object({
  description: z.string().min(10, "Blocker description must be at least 10 characters."),
});

type BlockerFormValues = z.infer<typeof blockerSchema>;

export function AddBlockerDialog({ isOpen, onOpenChange, onBlockerAdd }: AddBlockerDialogProps) {
  const form = useForm<BlockerFormValues>({
    resolver: zodResolver(blockerSchema),
    defaultValues: {
      description: "",
    },
  });

  function onSubmit(data: BlockerFormValues) {
    onBlockerAdd(data);
    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Blocker</DialogTitle>
          <DialogDescription>
            Describe the issue that is blocking project progress. This will be visible to management.
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
              <Button type="submit">Add Blocker</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
