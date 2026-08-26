"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { DataToolbar, ALL } from "@/components/ui/data-toolbar";
import { RejectDialog, RowReason } from "@/components/ui/approval-queue";
import { useToast } from "@/hooks/use-toast";
import { approveTimelineChange, rejectTimelineChange } from "@/app/timeline-approvals/actions";
import type { getPendingTimelineChanges } from "@/app/timeline-approvals/actions";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

// Derived from the action, so the dates cannot be declared as Dates when
// what actually arrives from the server is an ISO string.
type PendingRequestWithRelations = Awaited<ReturnType<typeof getPendingTimelineChanges>>[number];

type TimelineApprovalManagementProps = {
  initialRequests: PendingRequestWithRelations[];
  onDataChange: () => void;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** How far the deadline moves, which is the entire substance of the decision. */
function slipDays(request: PendingRequestWithRelations): number {
  return Math.round(
    (new Date(request.newEndDate).getTime() - new Date(request.oldEndDate).getTime()) / MS_PER_DAY,
  );
}

const SORT_OPTIONS = [
  { value: 'slip', label: 'Biggest change first' },
  { value: 'oldest', label: 'Longest waiting first' },
  { value: 'project', label: 'Project, A to Z' },
];

/**
 * Requests to move a project's committed deadline.
 *
 * This is the most consequential of the three queues and read as the least:
 * five columns, an untruncated reason paragraph stretching the row, and two
 * buttons. Nothing stated the size of the extension being asked for — the
 * reader had to subtract two dates in their head — and nothing said that
 * approving rewrites the project's end date while the original stays on record
 * as the thing the project is measured against.
 *
 * There is deliberately no bulk approve here. Extending a deadline is a
 * governance decision per project, and a "select all" would make it a
 * formality.
 */
export function TimelineApprovalManagement({ initialRequests, onDataChange }: TimelineApprovalManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [requestToReject, setRequestToReject] = useState<PendingRequestWithRelations | null>(null);
  const { hasPermission, localUser } = useAuth();

  const canManage = hasPermission('timeline:approve');

  const [search, setSearch] = useState('');
  const [size, setSize] = useState<string>(ALL);
  const [sort, setSort] = useState('slip');

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = initialRequests.filter((request) => {
      const slip = slipDays(request);
      if (size === 'major' && slip < 30) return false;
      if (size === 'minor' && slip >= 30) return false;
      if (!query) return true;
      return (
        String(request.project.name ?? '').toLowerCase().includes(query) ||
        String(request.requestedBy.name ?? '').toLowerCase().includes(query) ||
        String(request.reason ?? '').toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'slip') return slipDays(b) - slipDays(a);
      if (sort === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return String(a.project.name ?? '').localeCompare(String(b.project.name ?? ''));
    });
  }, [initialRequests, search, size, sort]);

  function handleApprove(requestId: string) {
    startTransition(async () => {
      if (!localUser) return;
      const result = await approveTimelineChange(requestId, localUser.id);
      if (result.success) {
        toast({
          title: "Deadline moved",
          description: "The project's end date has been updated. Its original commitment stays on record.",
        });
        onDataChange();
      } else {
        toast({ title: "That did not work", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleRejectSubmit(notes: string) {
    if (!requestToReject || !localUser) return;
    startTransition(async () => {
      const result = await rejectTimelineChange(requestToReject.id, localUser.id, notes);
      if (result.success) {
        toast({
          title: "Request refused",
          description: `${requestToReject.project.name} keeps its current deadline.`,
        });
        setRequestToReject(null);
        onDataChange();
      } else {
        toast({ title: "That did not work", description: result.error, variant: "destructive" });
      }
    });
  }

  if (initialRequests.length === 0) {
    return (
      <EmptyState
        variant="none-yours"
        icon={CheckCircle2}
        title="No deadline changes are waiting"
        description="Nobody has asked to move a project deadline. Requests appear here as soon as they are submitted."
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
            placeholder: 'Search projects, requesters or reasons…',
            label: 'Search timeline change requests',
          }}
          filters={[
            {
              id: 'size',
              label: 'Size',
              value: size,
              onChange: setSize,
              options: [
                { value: 'major', label: 'A month or more' },
                { value: 'minor', label: 'Under a month' },
              ],
              allLabel: 'Any size',
            },
          ]}
          sort={{ value: sort, onChange: setSort, options: SORT_OPTIONS }}
          count={{ showing: visible.length, total: initialRequests.length, noun: 'requests' }}
          onClearAll={() => {
            setSearch('');
            setSize(ALL);
          }}
        />

        {visible.length === 0 ? (
          <EmptyState
            variant="no-match"
            title="No requests match"
            description="There are requests waiting — none of them fit the filters you have set."
            compact
          />
        ) : (
          <Table scrollLabel="Timeline changes awaiting approval">
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead>Deadline change</TableHead>
                <TableHead>Reason given</TableHead>
                {canManage && <TableHead className="text-right">Decision</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((request) => {
                const slip = slipDays(request);
                const major = slip >= 30;

                return (
                  <TableRow key={request.id}>
                    <TableCell className="max-w-[200px] font-medium">
                      <Link
                        href={`/projects/${request.project.id}`}
                        className="block truncate rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {request.project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <span className="block truncate">{request.requestedBy.name}</span>
                      <RowReason>
                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                      </RowReason>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                        <span className="text-muted-foreground line-through">
                          {format(new Date(request.oldEndDate), 'd MMM yyyy')}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="font-medium">
                          {format(new Date(request.newEndDate), 'd MMM yyyy')}
                        </span>
                      </div>
                      {/* The size of the ask, stated rather than left as
                          mental arithmetic between two dates. */}
                      <RowReason tone={major ? 'urgent' : undefined}>
                        <span className={cn(major && 'font-medium')}>
                          {slip > 0
                            ? `${slip} days later`
                            : slip < 0
                              ? `${Math.abs(slip)} days earlier`
                              : 'No change in days'}
                        </span>
                      </RowReason>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <span className="line-clamp-3 text-sm">{request.reason}</span>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRequestToReject(request)}
                            disabled={isPending}
                          >
                            Refuse
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            disabled={isPending}
                          >
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
      </div>

      <RejectDialog
        open={!!requestToReject}
        onOpenChange={(open) => !open && setRequestToReject(null)}
        title="Refuse this deadline change?"
        subject={
          requestToReject && (
            <>
              <p className="font-medium">{requestToReject.project.name}</p>
              <p className="text-muted-foreground">
                {format(new Date(requestToReject.oldEndDate), 'd MMM yyyy')} →{' '}
                {format(new Date(requestToReject.newEndDate), 'd MMM yyyy')} ·{' '}
                {slipDays(requestToReject)} days · asked for by {requestToReject.requestedBy.name}
              </p>
            </>
          )
        }
        consequence="The project keeps its current deadline and stays measurable against it. Your reason goes back to whoever asked."
        placeholder="e.g. A four-month extension needs a re-baseline and sponsor sign-off, not a change request."
        isPending={isPending}
        onConfirm={handleRejectSubmit}
        confirmLabel="Refuse the change"
      />
    </>
  );
}
