
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

type ResolveBlockerDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  blocker: Blocker;
  onBlockerResolve: (blockerId: string, resolution: string) => void;
};

const blockerSchema = z.object({
  resolution: z.string().min(10, "Resolution must be at least 10 characters."),
});

type BlockerFormValues = z.infer<typeof blockerSchema>;

export function ResolveBlockerDialog({ isOpen, onOpenChange, blocker, onBlockerResolve }: ResolveBlockerDialogProps) {
  const form = useForm<BlockerFormValues>({
    resolver: zodResolver(blockerSchema),
    defaultValues: {
      resolution: "",
    },
  });

  function onSubmit(data: BlockerFormValues) {
    onBlockerResolve(blocker.id, data.resolution);
    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Blocker</DialogTitle>
          <DialogDescription>
            Provide the resolution details for the blocker. This will mark it as resolved.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 text-sm bg-muted/50 p-3 rounded-md border">
            <p className="font-semibold">Original Blocker:</p>
            <p className="text-muted-foreground">{blocker.description}</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="resolution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Details</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Security clearance was granted after escalating to the IT director."
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
              <Button type="submit">Resolve</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
