'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Inbox,
  ShieldAlert,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataToolbar, BulkActionBar, ALL } from '@/components/ui/data-toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard, StatCardGrid } from '@/components/ui/stat-card';
import { SlaPill } from '@/components/ui/status-pill';
import { RejectDialog, BulkApproveDialog, useRowSelection } from '@/components/ui/approval-queue';
import { useToast } from '@/hooks/use-toast';
import { decideApproval, decideApprovals } from '@/app/approvals/decide';
import {
  APPROVAL_KIND_LABEL,
  APPROVAL_SORT_OPTIONS,
  ageInDays,
  slaState,
  sortApprovals,
  summarizeInbox,
  type ApprovalItem,
  type ApprovalKind,
  type ApprovalSort,
  type SlaThresholds,
} from '@/lib/approvals/types';
import { cn } from '@/lib/utils';

/**
 * Everything waiting on one person, in one place.
 *
 * This replaces three separate queues — tasks, deadline changes, payments —
 * which between them had four problems that only a merge could fix:
 *
 *  - "what is waiting on me" needed three page visits and a mental sum;
 *  - none of them said how long anything had been sitting, so the oldest were
 *    routinely dealt with last;
 *  - none said what approving would actually *do*, though the three
 *    consequences are wildly different — closing a task, moving a committed
 *    deadline, releasing money;
 *  - deciding meant opening the underlying record in another tab, because the
 *    row carried a title and nothing else.
 *
 * So: one list, ordered by how close each item is to breaching its service
 * level, with the facts a reviewer needs rendered inline and both consequences
 * stated before either button is pressed.
 *
 * Laid out as cards rather than a table. Each row genuinely needs several
 * lines — facts, rationale, consequences — and a table that wraps to four
 * lines per row is a worse table and a much worse phone screen.
 */

const KIND_ICON: Record<ApprovalKind, LucideIcon> = {
  task: CheckCircle2,
  timeline: Clock,
  payment: Wallet,
};

export interface ApprovalsInboxProps {
  items: ApprovalItem[];
  thresholds: SlaThresholds;
  visibleKinds: ApprovalKind[];
  onDataChange: () => void;
}

export function ApprovalsInbox({
  items,
  thresholds,
  visibleKinds,
  onDataChange,
}: ApprovalsInboxProps) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = React.useTransition();
  const [rejecting, setRejecting] = React.useState<ApprovalItem | null>(null);
  const [bulkRejecting, setBulkRejecting] = React.useState(false);
  const [confirmingBulkApprove, setConfirmingBulkApprove] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<ApprovalSort>('sla');

  /**
   * The type filter lives in the URL.
   *
   * The retired queues redirect here carrying `?type=`, so an old
   * `/payment-approvals` bookmark lands on the payments slice of the inbox
   * rather than on an undifferentiated list.
   */
  const kindFilter = searchParams.get('type') ?? ALL;
  const setKindFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete('type');
    else params.set('type', value);
    router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`, { scroll: false });
  };

  const now = React.useMemo(() => new Date(), []);
  const summary = React.useMemo(
    () => summarizeInbox(items, thresholds, now),
    [items, thresholds, now],
  );

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (kindFilter !== ALL && item.kind !== kindFilter) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        (item.projectName ?? '').toLowerCase().includes(query) ||
        (item.requestedByName ?? '').toLowerCase().includes(query) ||
        (item.rationale ?? '').toLowerCase().includes(query)
      );
    });
    return sortApprovals(filtered, sort, thresholds, now);
  }, [items, search, kindFilter, sort, thresholds, now]);

  /** Only what this reviewer may act on can be selected for a bulk decision. */
  const decidable = React.useMemo(() => visible.filter((i) => i.canDecide), [visible]);
  const selection = useRowSelection(decidable);
  const selectedItems = React.useMemo(
    () => decidable.filter((i) => selection.isSelected(i.id)),
    [decidable, selection],
  );

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const report = (ok: boolean, title: string, description?: string) =>
    toast({ title, description, variant: ok ? undefined : 'destructive' });

  function approveOne(item: ApprovalItem) {
    startTransition(async () => {
      const result = await decideApproval({
        decision: 'approve',
        kind: item.kind,
        entityId: item.entityId,
      });
      report(result.success, result.success ? 'Approved' : 'That did not work', result.error);
      if (result.success) onDataChange();
    });
  }

  function rejectOne(reason: string) {
    if (!rejecting) return;
    const item = rejecting;
    startTransition(async () => {
      const result = await decideApproval({
        decision: 'reject',
        kind: item.kind,
        entityId: item.entityId,
        reason,
      });
      report(result.success, result.success ? 'Sent back' : 'That did not work', result.error);
      if (result.success) {
        setRejecting(null);
        onDataChange();
      }
    });
  }

  function bulkApprove() {
    const chosen = selectedItems;
    startTransition(async () => {
      const result = await decideApprovals(
        chosen.map((i) => ({ decision: 'approve', kind: i.kind, entityId: i.entityId })),
      );
      setConfirmingBulkApprove(false);
      selection.clear();
      // Partial success is reported as partial success: telling a reviewer the
      // batch failed when nine of ten landed makes them redo finished work.
      report(
        result.failed === 0,
        result.failed === 0
          ? `${result.succeeded} approved`
          : `${result.succeeded} approved, ${result.failed} could not be`,
        result.firstError,
      );
      onDataChange();
    });
  }

  function bulkReject(reason: string) {
    const chosen = selectedItems;
    startTransition(async () => {
      const result = await decideApprovals(
        chosen.map((i) => ({ decision: 'reject', kind: i.kind, entityId: i.entityId, reason })),
      );
      setBulkRejecting(false);
      selection.clear();
      report(
        result.failed === 0,
        result.failed === 0
          ? `${result.succeeded} sent back`
          : `${result.succeeded} sent back, ${result.failed} could not be`,
        result.firstError,
      );
      onDataChange();
    });
  }

  const kindOptions = visibleKinds.map((kind) => ({
    value: kind,
    label: `${APPROVAL_KIND_LABEL[kind]} (${summary.byKind[kind]})`,
  }));

  if (items.length === 0) {
    return (
      <EmptyState
        variant="none-yours"
        icon={Inbox}
        title="Nothing is waiting on you"
        description={
          visibleKinds.length === 0
            ? 'Your account does not hold any approval permissions, so nothing will appear here. Ask your administrator if that is wrong.'
            : `No ${visibleKinds.map((k) => APPROVAL_KIND_LABEL[k].toLowerCase()).join(', ')} needs a decision. Anything submitted will land here.`
        }
      />
    );
  }

  return (
    <>
      <StatCardGrid columns={3}>
        <StatCard
          label="Waiting on you"
          icon={Inbox}
          value={summary.total}
          hint={
            summary.oldestDays > 0
              ? `Longest has waited ${summary.oldestDays} day${summary.oldestDays === 1 ? '' : 's'}`
              : 'All submitted today'
          }
          interactive={false}
        />
        <StatCard
          label="Past the service level"
          icon={ShieldAlert}
          tone={summary.breached > 0 ? 'critical' : 'positive'}
          value={summary.breached}
          hint={`Decisions are expected within ${thresholds.slaDays} day${thresholds.slaDays === 1 ? '' : 's'}`}
          interactive={false}
        />
        <StatCard
          label="Due soon"
          icon={Clock}
          tone={summary.dueSoon > 0 ? 'warning' : 'neutral'}
          value={summary.dueSoon}
          hint={`Waiting ${thresholds.warningDays} day${thresholds.warningDays === 1 ? '' : 's'} or more`}
          interactive={false}
        />
      </StatCardGrid>

      <DataToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by title, project, person or reason…',
          label: 'Search the approvals inbox',
        }}
        filters={
          kindOptions.length > 1
            ? [
                {
                  id: 'type',
                  label: 'Type',
                  value: kindFilter,
                  onChange: setKindFilter,
                  options: kindOptions,
                  allLabel: `All types (${summary.total})`,
                },
              ]
            : []
        }
        sort={{
          value: sort,
          onChange: (v) => setSort(v as ApprovalSort),
          options: APPROVAL_SORT_OPTIONS,
        }}
        count={{ showing: visible.length, total: items.length, noun: 'decisions' }}
        onClearAll={() => {
          setSearch('');
          setKindFilter(ALL);
        }}
        actions={
          decidable.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selection.toggleAll(!selection.allSelected)}
            >
              {selection.allSelected ? 'Clear selection' : `Select all ${decidable.length}`}
            </Button>
          ) : undefined
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          variant="no-match"
          title="No decisions match"
          description="There are items waiting — none of them fit the filters you have set."
          compact
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id}>
              <ApprovalCard
                item={item}
                thresholds={thresholds}
                now={now}
                selected={selection.isSelected(item.id)}
                onSelect={(on) => selection.toggle(item.id, on)}
                expanded={expanded.has(item.id)}
                onToggleExpanded={() => toggleExpanded(item.id)}
                isPending={isPending}
                onApprove={() => approveOne(item)}
                onReject={() => setRejecting(item)}
              />
            </li>
          ))}
        </ul>
      )}

      <BulkActionBar selectedCount={selection.count} noun="decision" onClear={selection.clear}>
        <Button size="sm" onClick={() => setConfirmingBulkApprove(true)} disabled={isPending}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setBulkRejecting(true)}
          disabled={isPending}
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Send back
        </Button>
      </BulkActionBar>

      <RejectDialog
        open={!!rejecting}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={rejecting ? `Send back this ${APPROVAL_KIND_LABEL[rejecting.kind].toLowerCase()}?` : ''}
        subject={
          rejecting && (
            <>
              <p className="font-medium">{rejecting.title}</p>
              <p className="text-muted-foreground">
                {rejecting.projectName}
                {rejecting.requestedByName ? ` · ${rejecting.requestedByName}` : ''}
              </p>
            </>
          )
        }
        consequence={rejecting?.rejectEffect ?? ''}
        placeholder="Say what needs to change, not just that it was refused."
        isPending={isPending}
        onConfirm={rejectOne}
      />

      <RejectDialog
        open={bulkRejecting}
        onOpenChange={setBulkRejecting}
        title={`Send back ${selection.count} item${selection.count === 1 ? '' : 's'}?`}
        subject={
          <>
            <p className="font-medium">
              {selection.count} item{selection.count === 1 ? '' : 's'} across{' '}
              {new Set(selectedItems.map((i) => i.kind)).size} type
              {new Set(selectedItems.map((i) => i.kind)).size === 1 ? '' : 's'}
            </p>
            <p className="text-muted-foreground">
              {/* One reason goes to every submitter, so say so before it does. */}
              The same reason is sent to everyone who submitted these.
            </p>
          </>
        }
        consequence="Nothing is approved. Each item goes back to whoever submitted it, with your reason attached."
        placeholder="Say what needs to change. This text reaches every submitter in the selection."
        isPending={isPending}
        onConfirm={bulkReject}
        confirmLabel={`Send back ${selection.count}`}
      />

      <BulkApproveDialog
        open={confirmingBulkApprove}
        onOpenChange={setConfirmingBulkApprove}
        count={selection.count}
        noun="decision"
        consequence={
          // The three consequences differ enormously, so a mixed selection
          // spells out each kind rather than offering a single bland sentence.
          [...new Set(selectedItems.map((i) => i.kind))]
            .map((kind) => selectedItems.find((i) => i.kind === kind)!.approveEffect)
            .join(' ')
        }
        isPending={isPending}
        onConfirm={bulkApprove}
      />
    </>
  );
}

function ApprovalCard({
  item,
  thresholds,
  now,
  selected,
  onSelect,
  expanded,
  onToggleExpanded,
  isPending,
  onApprove,
  onReject,
}: {
  item: ApprovalItem;
  thresholds: SlaThresholds;
  now: Date;
  selected: boolean;
  onSelect: (on: boolean) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const state = slaState(item.submittedAt, thresholds, now);
  const age = ageInDays(item.submittedAt, now);
  const Icon = KIND_ICON[item.kind];

  return (
    <Card
      className={cn(
        'transition-colors',
        selected && 'border-ring bg-secondary/40',
        // A breach is marked on the card edge as well as in the pill, so it is
        // findable while scrolling without reading every badge.
        state === 'BREACHED' && !selected && 'border-destructive/40',
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          {item.canDecide && (
            <Checkbox
              checked={selected}
              onCheckedChange={(v) => onSelect(v === true)}
              aria-label={`Select ${item.title}`}
              className="mt-1 shrink-0"
            />
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 font-normal">
                <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                {APPROVAL_KIND_LABEL[item.kind]}
              </Badge>
              <SlaPill state={state} days={age} />
              {!item.canDecide && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  View only
                </Badge>
              )}
            </div>

            <div className="min-w-0">
              <p className="font-semibold leading-snug">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {item.projectName ?? 'No project'}
                {item.requestedByName ? ` · asked by ${item.requestedByName}` : ''}
              </p>
            </div>

            {/* The facts a reviewer would otherwise open the record to find. */}
            <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {item.facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline gap-1.5">
                  <dt className="text-muted-foreground">{fact.label}:</dt>
                  <dd className="font-medium tabular-nums">
                    {fact.from ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-muted-foreground line-through">{fact.from}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        <span>{fact.value}</span>
                      </span>
                    ) : (
                      fact.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            {item.rationale && (
              <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">
                <span className="line-clamp-3">{item.rationale}</span>
              </blockquote>
            )}

            {expanded && (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                <p>
                  <span className="font-medium">Approving:</span>{' '}
                  <span className="text-muted-foreground">{item.approveEffect}</span>
                </p>
                <p>
                  <span className="font-medium">Sending back:</span>{' '}
                  <span className="text-muted-foreground">{item.rejectEffect}</span>
                </p>
                {item.href && (
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Open the full record
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className="justify-start text-muted-foreground"
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
              aria-hidden="true"
            />
            {expanded ? 'Hide what happens next' : 'What happens if I decide?'}
          </Button>

          {item.canDecide && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onReject} disabled={isPending}>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Send back
              </Button>
              <Button size="sm" onClick={onApprove} disabled={isPending}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Approve
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
