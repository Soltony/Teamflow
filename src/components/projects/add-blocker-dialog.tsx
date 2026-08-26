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
import { Form } from "@/components/ui/form";
import { createBlockerSchema, type CreateBlockerInput } from "@/lib/validation/blocker";
import { BlockerFormFields, type OwnerOption } from "./blocker-form-fields";

type AddBlockerDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onBlockerAdd: (blocker: CreateBlockerInput) => void;
  owners: OwnerOption[];
};

export function AddBlockerDialog({
  isOpen,
  onOpenChange,
  onBlockerAdd,
  owners,
}: AddBlockerDialogProps) {
  // The same schema the server action validates against, so the form cannot
  // accept something the action will reject.
  const form = useForm<CreateBlockerInput>({
    resolver: zodResolver(createBlockerSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "OTHER",
      severity: "MEDIUM",
      impact: "",
      ownerId: "",
      dueDate: null,
    },
  });

  function onSubmit(data: CreateBlockerInput) {
    onBlockerAdd(data);
    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raise an issue</DialogTitle>
          <DialogDescription>
            Record what is blocking progress, how serious it is, and who will clear it. This is
            visible to management and appears in the project&apos;s reports.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <BlockerFormFields form={form} owners={owners} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Raise issue</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
