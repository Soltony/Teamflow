
"use client";

import { useState, useTransition, useMemo } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { approveTask, rejectTask } from "@/app/task-approvals/actions";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import Link from 'next/link';
import { Progress } from "../ui/progress";

type TaskWithRelations = any;

type TaskApprovalManagementProps = {
  initialTasks: TaskWithRelations[];
  onDataChange: () => void;
};

const rejectionSchema = z.object({
  notes: z.string().min(10, "A reason of at least 10 characters is required."),
});

type RejectionFormValues = z.infer<typeof rejectionSchema>;

export function TaskApprovalManagement({ initialTasks, onDataChange }: TaskApprovalManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [taskToReject, setTaskToReject] = useState<TaskWithRelations | null>(null);
  const { localUser, hasPermission } = useAuth();
  
  const canManage = hasPermission('tasks:approve');

  const form = useForm<RejectionFormValues>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { notes: "" },
  });

  function handleApprove(taskId: string) {
    startTransition(async () => {
        if (!localUser) return;
        await approveTask(taskId, localUser.id);
        toast({ title: "Task Approved!", description: "The task has been successfully reviewed." });
        onDataChange();
    });
  }
  
  function handleOpenRejectDialog(task: TaskWithRelations) {
    form.reset();
    setTaskToReject(task);
  }

  function handleRejectSubmit(data: RejectionFormValues) {
    if (!taskToReject || !localUser) return;
    startTransition(async () => {
      await rejectTask(taskToReject.id, localUser.id, data.notes);
      toast({ title: "Task Rejected", description: "The task has been sent back to 'In Progress'.", variant: "destructive" });
      setTaskToReject(null);
      onDataChange();
    });
  }

  const getProgressText = (task: TaskWithRelations) => {
    if (task.updates && task.updates.length > 0) {
      // Find the most recent update that was a 'COMMENT' and had a progress percentage
      const lastMeaningfulUpdate = task.updates
        .filter((u: any) => u.type === 'COMMENT' && u.progressPercentage !== null)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      const previousProgress = lastMeaningfulUpdate?.progressPercentage ?? 0;

      if (previousProgress !== task.progress) {
        return `${previousProgress}% → ${task.progress}%`;
      }
    }
    return `${task.progress}%`;
  };

  return (
    <>
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Assignees</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialTasks.length > 0 ? (
              initialTasks.map(task => {
                const assigneeNames = task.assignees.map((a: any) => a.name).join(', ');
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                        <Tooltip>
                            <TooltipTrigger>
                                <p className="max-w-[150px] truncate">{task.title}</p>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{task.title}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                           <p className="max-w-[200px] truncate">{task.description}</p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-md">{task.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                        <Tooltip>
                            <TooltipTrigger>
                                <Link href={`/projects/${task.milestone.project.id}`} className="hover:underline text-primary max-w-[150px] truncate block">
                                    {task.milestone.project.name}
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{task.milestone.project.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TableCell>
                    <TableCell>{assigneeNames}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={task.progress} className="h-2 w-20" />
                        <span className="text-sm font-medium">{getProgressText(task)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(task.endDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleOpenRejectDialog(task)} disabled={isPending}>
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(task.id)} disabled={isPending}>
                            Approve
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No tasks are currently pending review.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TooltipProvider>
      
      <Dialog open={!!taskToReject} onOpenChange={() => setTaskToReject(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Task</DialogTitle>
                <DialogDescription>
                    Provide a reason for rejecting this task. This will be visible to the assignees.
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
                            placeholder="e.g., The feature is missing responsive styles for mobile devices."
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
                <Button variant="outline" onClick={() => setTaskToReject(null)}>Cancel</Button>
                <Button type="submit" form="rejection-form" variant="destructive" disabled={isPending}>
                    {isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
