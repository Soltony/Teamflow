"use client";

import { useEffect } from "react";
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
import { Form } from "@/components/ui/form";
import { createBlockerSchema, type CreateBlockerInput } from "@/lib/validation/blocker";
import type { Blocker } from "@/lib/types";
import { BlockerFormFields, type OwnerOption } from "./blocker-form-fields";

type EditBlockerDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  blocker: Blocker;
  onBlockerUpdate: (blockerId: string, values: CreateBlockerInput) => void;
  owners: OwnerOption[];
};

export function EditBlockerDialog({
  isOpen,
  onOpenChange,
  blocker,
  onBlockerUpdate,
  owners,
}: EditBlockerDialogProps) {
  const form = useForm<CreateBlockerInput>({
    resolver: zodResolver(createBlockerSchema),
  });

  useEffect(() => {
    if (blocker) {
      form.reset({
        title: blocker.title,
        description: blocker.description,
        category: blocker.category,
        severity: blocker.severity,
        impact: blocker.impact ?? "",
        ownerId: blocker.ownerId ?? "",
        // Stored as an ISO string once it has crossed the boundary.
        dueDate: blocker.dueDate ? new Date(blocker.dueDate) : null,
      });
    }
  }, [blocker, form]);

  function onSubmit(data: CreateBlockerInput) {
    onBlockerUpdate(blocker.id, data);
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit issue</DialogTitle>
          <DialogDescription>
            Change any detail of this issue. Resolving it is a separate step, because it records
            how it was resolved.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <BlockerFormFields form={form} owners={owners} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
