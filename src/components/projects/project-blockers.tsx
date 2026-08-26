"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowUpCircle, Pencil, PlusCircle, ShieldAlert, ShieldCheck, Trash2, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Blocker, BlockerSeverity } from "@/lib/types";
import { isOpenBlocker, isOverdueBlocker, isUnmanaged } from "@/lib/validation/blocker";
import type { OwnerOption } from "./blocker-form-fields";

/**
 * The project's issue register.
 *
 * Lifted out of project-view.tsx, which had grown past five hundred lines by
 * holding every tab's markup inline. Beyond the file size, the register needs
 * its own filter state, and that state has no business re-rendering the
 * milestones tab.
 */

const SEVERITY_STYLE: Record<BlockerSeverity, string> = {
  CRITICAL: "bg-destructive text-destructive-foreground",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-500 text-black",
  LOW: "bg-muted text-muted-foreground",
};

/** Highest first: a register is read from the top. */
const SEVERITY_ORDER: Record<BlockerSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "Being worked",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const CATEGORY_LABEL: Record<string, string> = {
  RESOURCE: "People or resources",
  TECHNICAL: "Technical",
  VENDOR: "Vendor or supplier",
  FINANCIAL: "Budget or payment",
  DEPENDENCY: "Waiting on another team",
  REGULATORY: "Regulatory or compliance",
  SCOPE: "Scope or requirements",
  OTHER: "Other",
};

export interface ProjectBlockersProps {
  blockers: Blocker[];
  owners: OwnerOption[];
  canUpdate: boolean;
  onAdd: () => void;
  onEdit: (blocker: Blocker) => void;
  onResolve: (blocker: Blocker) => void;
  onEscalate: (blocker: Blocker) => void;
  onDelete: (blocker: Blocker) => void;
}

export function ProjectBlockers({
  blockers,
  owners,
  canUpdate,
  onAdd,
  onEdit,
  onResolve,
  onEscalate,
  onDelete,
}: ProjectBlockersProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  const ownerName = useMemo(
    () => new Map(owners.map((o) => [o.id, o.name])),
    [owners],
  );

  const visible = useMemo(() => {
    return blockers
      .filter((b) => (showResolved ? true : isOpenBlocker(b.status)))
      .filter((b) => (severityFilter === "ALL" ? true : b.severity === severityFilter))
      .slice()
      .sort((a, b) => {
        // Open before closed, then most serious, then soonest due.
        const aOpen = isOpenBlocker(a.status) ? 0 : 1;
        const bOpen = isOpenBlocker(b.status) ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (bySeverity !== 0) return bySeverity;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [blockers, showResolved, severityFilter]);

  const openCount = blockers.filter((b) => isOpenBlocker(b.status)).length;
  const overdueCount = blockers.filter((b) => isOverdueBlocker(b)).length;
  const unmanagedCount = blockers.filter((b) => isUnmanaged(b)).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Issue register</CardTitle>
          {canUpdate && (
            <Button onClick={onAdd}>
              <PlusCircle className="mr-2 h-4 w-4" /> Raise an issue
            </Button>
          )}
        </div>
        <CardDescription>
          What is holding this project up, who owns it, and when it must clear.
        </CardDescription>

        {/* The two counts worth acting on, rather than a total nobody can use. */}
        {(overdueCount > 0 || unmanagedCount > 0) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} past the date agreed
              </Badge>
            )}
            {unmanagedCount > 0 && (
              <Badge variant="outline" className="gap-1 border-orange-500 text-orange-600">
                <UserX className="h-3 w-3" />
                {unmanagedCount} without an owner or a date
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All severities</SelectItem>
              <SelectItem value="CRITICAL">Critical only</SelectItem>
              <SelectItem value="HIGH">High only</SelectItem>
              <SelectItem value="MEDIUM">Medium only</SelectItem>
              <SelectItem value="LOW">Low only</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? "Hide resolved and closed" : `Show resolved and closed`}
          </Button>
          <span className="text-sm text-muted-foreground">
            {openCount} open of {blockers.length}
          </span>
        </div>

        <div className="space-y-4">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {blockers.length === 0
                ? "Nothing is blocking this project."
                : "No issues match this filter."}
            </p>
          ) : (
            visible.map((blocker, index) => {
              const open = isOpenBlocker(blocker.status);
              const overdue = isOverdueBlocker(blocker);
              return (
                <div key={blocker.id}>
                  <div className="flex items-start gap-4">
                    <div>
                      {open ? (
                        <ShieldAlert
                          className={cn(
                            "mt-1 h-5 w-5",
                            blocker.severity === "CRITICAL" || blocker.severity === "HIGH"
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        />
                      ) : (
                        <ShieldCheck className="mt-1 h-5 w-5 text-green-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{blocker.title}</p>
                        <Badge className={SEVERITY_STYLE[blocker.severity]}>
                          {blocker.severity.charAt(0) + blocker.severity.slice(1).toLowerCase()}
                        </Badge>
                        <Badge variant="outline">
                          {STATUS_LABEL[blocker.status] ?? blocker.status}
                        </Badge>
                        {overdue && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Overdue
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">{blocker.description}</p>

                      {blocker.impact && (
                        <p className="mt-1 text-sm">
                          <span className="font-medium">Holding up: </span>
                          <span className="text-muted-foreground">{blocker.impact}</span>
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{CATEGORY_LABEL[blocker.category] ?? blocker.category}</span>
                        <span>
                          Owner:{" "}
                          {blocker.owner?.name ??
                            (blocker.ownerId ? ownerName.get(blocker.ownerId) : null) ?? (
                              <span className="font-medium text-orange-600">nobody</span>
                            )}
                        </span>
                        <span>
                          Clear by:{" "}
                          {blocker.dueDate ? (
                            format(parseISO(blocker.dueDate), "dd MMM yyyy")
                          ) : (
                            <span className="font-medium text-orange-600">no date agreed</span>
                          )}
                        </span>
                        <span>Raised {format(parseISO(blocker.createdAt), "dd MMM yyyy")}</span>
                      </div>

                      {blocker.status === "ESCALATED" && blocker.escalatedAt && (
                        <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-900 dark:bg-orange-950/30">
                          <p className="text-xs font-semibold">
                            Escalated to {blocker.escalatedTo?.name ?? "someone"} on{" "}
                            {format(parseISO(blocker.escalatedAt), "dd MMM yyyy")}
                          </p>
                          <p className="text-muted-foreground">{blocker.escalationReason}</p>
                        </div>
                      )}

                      {blocker.status === "RESOLVED" && (
                        <div className="mt-2 rounded-md border bg-muted/50 p-3 text-sm">
                          <p className="text-xs font-semibold">
                            Resolved
                            {blocker.resolvedAt
                              ? ` on ${format(parseISO(blocker.resolvedAt), "dd MMM yyyy")}`
                              : ""}
                          </p>
                          <p className="text-muted-foreground">{blocker.resolution}</p>
                        </div>
                      )}
                    </div>

                    {canUpdate && (
                      <div className="flex shrink-0 items-center gap-1">
                        {open && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => onEdit(blocker)}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit issue</span>
                            </Button>
                            {blocker.status !== "ESCALATED" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEscalate(blocker)}
                              >
                                <ArrowUpCircle className="h-4 w-4" />
                                <span className="sr-only">Escalate issue</span>
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => onResolve(blocker)}>
                              Resolve
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(blocker)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete issue</span>
                        </Button>
                      </div>
                    )}
                  </div>
                  {index < visible.length - 1 && <Separator className="my-4" />}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
