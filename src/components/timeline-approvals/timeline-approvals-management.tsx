
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { approveTimelineChange, rejectTimelineChange } from "@/app/timeline-approvals/actions";
import type { getPendingTimelineChanges } from "@/app/timeline-approvals/actions";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import { Badge } from "../ui/badge";
import { ArrowRight } from "lucide-react";

// Derived from the action, so the dates cannot be declared as Dates when
// what actually arrives from the server is an ISO string.
type PendingRequestWithRelations = Awaited<ReturnType<typeof getPendingTimelineChanges>>[number];

type TimelineApprovalManagementProps = {
  initialRequests: PendingRequestWithRelations[];
  onDataChange: () => void;
};

const rejectionSchema = z.object({
  notes: z.string().min(10, "A reason of at least 10 characters is required."),
});

type RejectionFormValues = z.infer<typeof rejectionSchema>;

export function TimelineApprovalManagement({ initialRequests, onDataChange }: TimelineApprovalManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [requestToReject, setRequestToReject] = useState<PendingRequestWithRelations | null>(null);
  const { hasPermission, localUser } = useAuth();
  
  const canManage = hasPermission('timeline:approve');

  const form = useForm<RejectionFormValues>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { notes: "" },
  });

  function handleApprove(requestId: string) {
    startTransition(async () => {
        if (!localUser) return;
        const result = await approveTimelineChange(requestId, localUser.id);
        if (result.success) {
            toast({ title: "Change Approved!", description: "The project timeline has been updated." });
            onDataChange();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    });
  }
  
  function handleOpenRejectDialog(request: PendingRequestWithRelations) {
    form.reset();
    setRequestToReject(request);
  }

  function handleRejectSubmit(data: RejectionFormValues) {
    if (!requestToReject || !localUser) return;
    startTransition(async () => {
      const result = await rejectTimelineChange(requestToReject.id, localUser.id, data.notes);
      if (result.success) {
        toast({ title: "Change Rejected", description: "The timeline change request has been rejected.", variant: "destructive" });
        setRequestToReject(null);
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <>
      <Table scrollLabel="Timeline changes awaiting approval">
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Requested By</TableHead>
            <TableHead>Deadline Change</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialRequests.length > 0 ? (
            initialRequests.map(request => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.project.name}</TableCell>
                  <TableCell>{request.requestedBy.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">{format(new Date(request.oldEndDate), 'MMM dd, yyyy')}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="default">{format(new Date(request.newEndDate), 'MMM dd, yyyy')}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>{request.reason}</TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleOpenRejectDialog(request)} disabled={isPending}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => handleApprove(request.id)} disabled={isPending}>
                          Approve
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No pending timeline change requests.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      
      <Dialog open={!!requestToReject} onOpenChange={() => setRequestToReject(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Timeline Change</DialogTitle>
                <DialogDescription>
                    Provide a reason for rejecting this request. This will be visible to the original submitter.
                </DialogDescription>
            </DialogHeader>
             <Form {...form}>
              <form id="rejection-form" onSubmit={form.handleSubmit(handleRejectSubmit)} className="space-y-4 py-4">
                 <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Reason for Rejection</FormLabel>
                        <FormControl>
                        <Textarea
                            placeholder="e.g., The justification provided is insufficient for a delay of this length."
                            className="min-h-[120px]"
                            {...field}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </form>
            </Form>
            <DialogFooter>
                <Button variant="outline" onClick={() => setRequestToReject(null)}>Cancel</Button>
                <Button type="submit" form="rejection-form" variant="destructive" disabled={isPending}>
                    {isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
