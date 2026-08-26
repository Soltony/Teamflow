"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { DataToolbar, BulkActionBar, ALL } from "@/components/ui/data-toolbar";
import {
  BulkApproveDialog,
  RejectDialog,
  RowReason,
  SelectAllHead,
  SelectRowCell,
  useRowSelection,
} from "@/components/ui/approval-queue";
import { useToast } from "@/hooks/use-toast";
import { approveTask, rejectTask } from "@/app/task-approvals/actions";
import { useAuth } from "@/context/auth-context";
import { daysUntil } from "@/lib/ui/health";
import { TASK_SORT_OPTIONS, sortTasks, type TaskSort } from "@/lib/ui/sort";

type TaskWithRelations = any;

type TaskApprovalManagementProps = {
  initialTasks: TaskWithRelations[];
  onDataChange: () => void;
};

/**
 * Tasks their assignees say are finished, waiting on a reviewer.
 *
 * The table this replaces showed a title, a project, assignee names, a
 * progress bar and a due date. Nothing said why any given row was urgent, and
 * nothing said what the two buttons at the end of it would do. A reviewer with
 * twenty rows had no way to tell the one that has been sitting a fortnight from
 * the one submitted this morning, and had to approve them one at a time.
 */
export function TaskApprovalManagement({ initialTasks, onDataChange }: TaskApprovalManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [taskToReject, setTaskToReject] = useState<TaskWithRelations | null>(null);
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const { localUser, hasPermission } = useAuth();

  const canManage = hasPermission('tasks:approve');

  const [search, setSearch] = useState('');
  const [project, setProject] = useState<string>(ALL);
  const [sort, setSort] = useState<TaskSort>('due');

  const projectOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const task of initialTasks) {
      const p = task.milestone?.project;
      if (p) seen.set(p.id, p.name);
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [initialTasks]);

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = initialTasks.filter((task: any) => {
      if (project !== ALL && task.milestone?.project?.id !== project) return false;
      if (!query) return true;
      return (
        String(task.title ?? '').toLowerCase().includes(query) ||
        String(task.milestone?.project?.name ?? '').toLowerCase().includes(query) ||
        task.assignees?.some((a: any) => String(a.name ?? '').toLowerCase().includes(query))
      );
    });
    return sortTasks(filtered, sort);
  }, [initialTasks, search, project, sort]);

  const selection = useRowSelection(visible as { id: string }[]);

  function handleApprove(taskId: string) {
    startTransition(async () => {
      if (!localUser) return;
      const result = await approveTask(taskId, localUser.id);
      if (result.success) {
        toast({ title: "Task approved", description: result.message });
        onDataChange();
      } else {
        toast({ title: "That did not work", description: result.error, variant: "destructive" });
      }
    });
  }

  /**
   * Approving a selection.
   *
   * Sequential rather than parallel: each approval recalculates milestone
   * progress and may close the milestone, and firing them at once against the
   * same project races on that. Slower, and right.
   */
  function handleBulkApprove() {
    startTransition(async () => {
      if (!localUser) return;
      const ids = [...selection.selected];
      let approved = 0;
      const failures: string[] = [];

      for (const id of ids) {
        const result = await approveTask(id, localUser.id);
        if (result.success) approved += 1;
        else failures.push(result.error ?? 'Unknown error');
      }

      setConfirmingBulk(false);
      selection.clear();

      if (failures.length === 0) {
        toast({
          title: `${approved} task${approved === 1 ? '' : 's'} approved`,
          description: 'They are marked done and out of their assignees’ lists.',
        });
      } else {
        // Partial success is reported as partial success. Reporting it as a
        // flat failure would have the reviewer redo work that already landed.
        toast({
          title: `${approved} approved, ${failures.length} could not be`,
          description: failures[0],
          variant: "destructive",
        });
      }
      onDataChange();
    });
  }

  function handleRejectSubmit(notes: string) {
    if (!taskToReject || !localUser) return;
    startTransition(async () => {
      const result = await rejectTask(taskToReject.id, localUser.id, notes);
      if (result.success) {
        toast({
          title: "Task sent back",
          description: `"${taskToReject.title}" has returned to In progress with your reason attached.`,
        });
        setTaskToReject(null);
        onDataChange();
      } else {
        toast({ title: "That did not work", description: result.error, variant: "destructive" });
      }
    });
  }

  /**
   * What the assignee moved, rather than where they ended up.
   *
   * "60% → 100%" is the thing a reviewer is actually checking; a bare "100%"
   * says nothing about the claim being made.
   */
  const progressMovement = (task: TaskWithRelations) => {
    const reported = task.updates
      ?.filter((u: any) => u.type === 'COMMENT' && u.progressPercentage !== null)
      .sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const previous = reported?.[1]?.progressPercentage ?? null;
    if (previous !== null && previous !== task.progress) {
      return `${previous}% → ${task.progress}%`;
    }
    return `${task.progress}%`;
  };

  if (initialTasks.length === 0) {
    return (
      <EmptyState
        variant="none-yours"
        icon={CheckCircle2}
        title="Nothing is waiting on you"
        description="No task has been submitted for review. Anything an assignee marks complete will land here."
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        <DataToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search tasks, projects or people…',
            label: 'Search tasks awaiting review',
          }}
          filters={[
            {
              id: 'project',
              label: 'Project',
              value: project,
              onChange: setProject,
              options: projectOptions,
              allLabel: 'All projects',
            },
          ]}
          sort={{
            value: sort,
            onChange: (v) => setSort(v as TaskSort),
            options: TASK_SORT_OPTIONS,
          }}
          count={{ showing: visible.length, total: initialTasks.length, noun: 'tasks' }}
          onClearAll={() => {
            setSearch('');
            setProject(ALL);
          }}
        />

        {visible.length === 0 ? (
          <EmptyState
            variant="no-match"
            title="No tasks match"
            description="There are tasks awaiting review — none of them fit the filters you have set."
            compact
          />
        ) : (
          <Table scrollLabel="Tasks awaiting approval">
            <TableHeader>
              <TableRow>
                {canManage && (
                  <SelectAllHead
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected}
                    onChange={selection.toggleAll}
                    label="Select all tasks in this list"
                  />
                )}
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Progress claimed</TableHead>
                <TableHead>Due</TableHead>
                {canManage && <TableHead className="text-right">Decision</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((task: any) => {
                const assigneeNames = task.assignees?.map((a: any) => a.name).join(', ') || 'Nobody';
                const remaining = daysUntil({ endDate: task.endDate });
                const overdue = remaining !== null && remaining < 0;

                return (
                  <TableRow key={task.id} data-state={selection.isSelected(task.id) ? 'selected' : undefined}>
                    {canManage && (
                      <SelectRowCell
                        checked={selection.isSelected(task.id)}
                        onChange={(on) => selection.toggle(task.id, on)}
                        label={`Select ${task.title}`}
                      />
                    )}
                    <TableCell className="max-w-[240px] font-medium">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="block truncate rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {task.title}
                      </Link>
                      {overdue && (
                        <RowReason tone="urgent">
                          {Math.abs(remaining!)} days past its due date
                        </RowReason>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <Link
                        href={`/projects/${task.milestone.project.id}`}
                        className="block truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title={task.milestone.project.name}
                      >
                        {task.milestone.project.name}
                      </Link>
                      <RowReason>{task.milestone.title}</RowReason>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate" title={assigneeNames}>
                      {assigneeNames}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={task.progress} className="h-2 w-16" />
                        <span className="whitespace-nowrap text-sm font-medium tabular-nums">
                          {progressMovement(task)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(task.endDate), 'd MMM yyyy')}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTaskToReject(task)}
                            disabled={isPending}
                          >
                            Send back
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(task.id)} disabled={isPending}>
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {canManage && (
          <BulkActionBar selectedCount={selection.count} noun="task" onClear={selection.clear}>
            <Button size="sm" onClick={() => setConfirmingBulk(true)} disabled={isPending}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Approve selected
            </Button>
          </BulkActionBar>
        )}
      </div>

      <RejectDialog
        open={!!taskToReject}
        onOpenChange={(open) => !open && setTaskToReject(null)}
        title="Send this task back?"
        subject={
          taskToReject && (
            <>
              <p className="font-medium">{taskToReject.title}</p>
              <p className="text-muted-foreground">
                {taskToReject.milestone?.project?.name} ·{' '}
                {taskToReject.assignees?.map((a: any) => a.name).join(', ')}
              </p>
            </>
          )
        }
        consequence="The task returns to In progress and stays with its assignees. Your reason is added to its history, so they can see exactly what needs fixing."
        placeholder="e.g. The integration tests referenced in the update have not been run against the staging environment."
        isPending={isPending}
        onConfirm={handleRejectSubmit}
      />

      <BulkApproveDialog
        open={confirmingBulk}
        onOpenChange={setConfirmingBulk}
        count={selection.count}
        noun="task"
        consequence="Each one is marked done, closed out of its assignee's list, and counted towards its milestone's progress."
        isPending={isPending}
        onConfirm={handleBulkApprove}
      />
    </>
  );
}
