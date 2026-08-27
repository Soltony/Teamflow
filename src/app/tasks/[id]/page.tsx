'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, formatDistanceToNow } from 'date-fns';
import {
  CalendarDays,
  CheckCircle,
  MessageSquare,
  Scale,
  Send,
  TrendingUp,
  XCircle,
} from 'lucide-react';

import { useAuth } from '@/context/auth-context';
import { getTaskDetails, type TaskDetails } from './actions';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import { ActionRequired } from '@/components/ui/action-required';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader, PageShell } from '@/components/ui/page-header';
import { StatCard, StatCardGrid } from '@/components/ui/stat-card';
import { TaskStatusPill } from '@/components/ui/status-pill';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { addTaskUpdateAction } from '@/app/my-tasks/actions';
import { approveTaskAction, declineTaskAction } from '@/app/team-view/actions';
import { DeclineTaskDialog } from '@/components/tasks/decline-task-dialog';
import type { TeamViewTask } from '@/app/team-view/page';
import { useFirstLoad } from '@/hooks/use-first-load';
import { daysUntil } from '@/lib/ui/health';

/**
 * One task: what it is, how it is going, and — if it is waiting on you — what
 * you are being asked to decide.
 *
 * The screen this replaces buried the decision. A task sitting in
 * PENDING_REVIEW rendered a card headed "Review Task" containing two buttons,
 * at the bottom of the right-hand column, below the updates feed. On a laptop
 * that card was off-screen on load, so the only signal that a task needed a
 * reviewer's attention was a grey "PENDING REVIEW" badge in a list of
 * key-value pairs. Nothing said what approving would do, and nothing said what
 * declining would do to the assignee.
 *
 * The banner now leads the page, states the consequence of both choices before
 * either is taken, and carries the buttons itself.
 */

function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading task">
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-4 w-72" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-96" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-80 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}

const taskUpdateSchema = (taskProgress: number) =>
  z.object({
    text: z
      .string()
      .min(10, 'Say what you did, in at least 10 characters.')
      .max(500, 'Keep the update under 500 characters.'),
    progressPercentage: z
      .number()
      .min(taskProgress, `Progress cannot go backward. It currently stands at ${taskProgress}%.`)
      .max(100, 'Progress cannot exceed 100%.'),
  });

type TaskUpdateFormValues = z.infer<ReturnType<typeof taskUpdateSchema>>;

export default function TaskDetailsPage() {
  const { id } = useParams();
  const taskId = id as string;
  const { localUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<TaskDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [taskToDecline, setTaskToDecline] = useState<TeamViewTask | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);

  const fetchTask = useCallback(async () => {
    if (!localUser?.id || !taskId) return;

    setIsLoading(true);
    setLoadError(null);
    try {
      const taskData = await getTaskDetails(taskId, localUser.id);
      if (taskData) {
        setData(taskData);
      } else {
        // Not an error: the query returns null both for a task that is gone
        // and for one this person may not see. Say so here rather than
        // bouncing to the dashboard with a toast that scrolls away.
        setData(null);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
    } finally {
      setIsLoading(false);
    }
  }, [localUser?.id, taskId]);

  useEffect(() => {
    if (!authLoading) {
      fetchTask();
    }
  }, [authLoading, fetchTask]);

  const { task, allUsers } = data || {};
  const userMap = useMemo(() => new Map(allUsers?.map((u) => [u.id, u])), [allUsers]);

  const currentProgress = task?.progress ?? 0;
  const form = useForm<TaskUpdateFormValues>({
    resolver: zodResolver(taskUpdateSchema(currentProgress)),
    defaultValues: { text: '', progressPercentage: currentProgress },
  });

  const isTeamLeadOrManager = localUser?.roles.some(
    (role) =>
      role.permissions.includes('projects:read') &&
      role.permissions.includes('projects:update') &&
      role.permissions.includes('projects:delete'),
  );

  const handleUpdateSubmit = async (formData: TaskUpdateFormValues) => {
    if (!task || !localUser) return;
    if (formData.progressPercentage === currentProgress) {
      toast({
        title: 'Move the progress slider first',
        description:
          'An update records how far the work has come. Leaving progress unchanged posts nothing new.',
        variant: 'destructive',
      });
      return;
    }

    const result = await addTaskUpdateAction(
      task.id,
      formData.text,
      localUser.id,
      formData.progressPercentage,
    );
    if (result.success) {
      toast({
        title: 'Update posted',
        description:
          formData.progressPercentage === 100
            ? 'The task is now with your reviewer.'
            : 'Your progress has been recorded.',
      });
      await fetchTask();
      form.reset({ text: '', progressPercentage: formData.progressPercentage });
    } else {
      toast({ title: 'That did not work', description: result.error, variant: 'destructive' });
    }
  };

  const handleApprove = async () => {
    if (!task || !localUser) return;
    setIsDeciding(true);
    const result = await approveTaskAction(task.id, localUser.id, localUser.name);
    setIsDeciding(false);
    if (result.success) {
      toast({ title: 'Task approved', description: `"${task.title}" is now marked done.` });
      await fetchTask();
    } else {
      toast({ title: 'That did not work', description: result.error, variant: 'destructive' });
    }
  };

  const handleDeclineConfirm = async (reason: string) => {
    if (!task || !localUser) return;
    setIsDeciding(true);
    const result = await declineTaskAction(task.id, localUser.id, localUser.name, reason);
    setIsDeciding(false);
    if (result.success) {
      toast({
        title: 'Task sent back',
        description: `"${task.title}" has returned to In progress with your reason attached.`,
      });
      await fetchTask();
    } else {
      toast({ title: 'That did not work', description: result.error, variant: 'destructive' });
    }
    setTaskToDecline(null);
  };

  // Only on the very first load. Rendering the skeleton on every refresh
  // unmounted the page body, destroying any dialog that was open.
  const showSkeleton = useFirstLoad(isLoading);

  if (showSkeleton || authLoading) {
    return <LoadingSkeleton />;
  }

  if (loadError) {
    return (
      <PageShell>
        <ErrorState variant="load" detail={loadError} onRetry={fetchTask} href="/my-tasks" hrefLabel="Back to my tasks" />
      </PageShell>
    );
  }

  if (!task) {
    return (
      <PageShell>
        <ErrorState
          variant="not-found"
          title="This task is not available to you"
          description="It may have been deleted, or it may belong to a project you are not on. Tasks are visible to their assignees and to anyone who can approve them."
          href="/my-tasks"
          hrefLabel="Back to my tasks"
        />
      </PageShell>
    );
  }

  const assignees = task.assignedUserIds
    .map((assigneeId: string) => userMap.get(assigneeId))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));

  const isPendingReview = task.status === 'PENDING_REVIEW';
  const canReview = isPendingReview && isTeamLeadOrManager;
  const canUpdate = task.status !== 'DONE' && !canReview;
  const remaining = daysUntil({ endDate: task.endDate });
  const assigneeNames = assignees.map((u) => u.name).join(', ');

  return (
    <>
      <PageShell>
        <PageHeader
          breadcrumbs={[
            { label: 'Projects', href: '/projects' },
            { label: task.milestone.project.name, href: `/projects/${task.milestone.project.id}` },
            { label: task.milestone.title },
            { label: task.title },
          ]}
          title={task.title}
          meta={
            <>
              <TaskStatusPill status={task.status} />
              <span className="text-muted-foreground">
                Assigned to {assigneeNames || 'nobody'}
              </span>
            </>
          }
        />

        {/*
          The state of play, stated once at the top. Every branch here answers
          the same three questions in the same order: what is happening, why,
          and what to do next.
        */}
        {canReview ? (
          <ActionRequired
            tone="action"
            title="This task is waiting for your review"
            reason={
              <>
                {assigneeNames || 'The assignee'} reported the work {task.progress}% complete and
                submitted it for review
                {task.updates?.[0]?.createdAt
                  ? ` ${formatDistanceToNow(new Date(task.updates[0].createdAt), { addSuffix: true })}`
                  : ''}
                . Nothing moves until you decide.
              </>
            }
            nextStep="Approving marks the task done and closes it out of the assignee's list. Declining sends it back to In progress with your reason attached, so they know what to fix."
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={() => setTaskToDecline(task as unknown as TeamViewTask)}
                  disabled={isDeciding}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Decline
                </Button>
                <Button onClick={handleApprove} disabled={isDeciding}>
                  <CheckCircle className="h-4 w-4" aria-hidden="true" />
                  {isDeciding ? 'Working…' : 'Approve'}
                </Button>
              </>
            }
          />
        ) : isPendingReview ? (
          <ActionRequired
            tone="waiting"
            title="Submitted for review"
            reason="The work has been handed to a reviewer. It will move to Done once they approve it, or come back to you with a reason if they do not."
            nextStep="Nothing is needed from you while it sits here."
          />
        ) : task.status === 'DONE' ? (
          <ActionRequired
            tone="done"
            title="This task is done"
            reason="It has been reviewed and approved. It no longer counts against the milestone as outstanding work."
          />
        ) : remaining !== null && remaining < 0 ? (
          <ActionRequired
            tone="action"
            title={`This task is ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? '' : 's'} past its due date`}
            reason={`It is ${task.progress}% complete and still open, so it is holding up the ${task.milestone.title} milestone.`}
            nextStep="Post an update saying where it stands. If the date is no longer realistic, raise it with the project manager."
          />
        ) : null}

        <StatCardGrid>
          <StatCard
            label="Progress"
            icon={TrendingUp}
            value={`${task.progress || 0}%`}
            progress={task.progress || 0}
            hint={task.status === 'DONE' ? 'Approved and closed' : 'Reported by the assignee'}
            interactive={false}
          />
          <StatCard
            label="Due"
            icon={CalendarDays}
            tone={
              task.status === 'DONE'
                ? 'neutral'
                : remaining === null
                  ? 'neutral'
                  : remaining < 0
                    ? 'critical'
                    : remaining <= 3
                      ? 'warning'
                      : 'neutral'
            }
            value={format(new Date(task.endDate), 'd MMM yyyy')}
            hint={
              task.status === 'DONE'
                ? 'Deadline no longer applies'
                : remaining === null
                  ? ''
                  : remaining < 0
                    ? `${Math.abs(remaining)} days over`
                    : `${remaining} days left`
            }
            interactive={false}
          />
          <StatCard
            label="Weight"
            icon={Scale}
            value={`${task.weight}%`}
            hint={`Share of the ${task.milestone.title} milestone`}
            interactive={false}
          />
          <StatCard
            label="Updates"
            icon={MessageSquare}
            value={task.updates?.length ?? 0}
            hint={
              task.updates?.[0]?.createdAt
                ? `Last ${formatDistanceToNow(new Date(task.updates[0].createdAt), { addSuffix: true })}`
                : 'Nothing posted yet'
            }
            interactive={false}
          />
        </StatCardGrid>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {canUpdate && (
              <Card>
                <CardHeader>
                  <CardTitle>Post an update</CardTitle>
                  <CardDescription>
                    Say what has moved and set progress to match. Reaching 100% submits the task for
                    review.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleUpdateSubmit)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="text"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>What has changed</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="e.g. Vendor contract signed; integration testing starts Monday."
                                className="min-h-[90px]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="progressPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Progress:{' '}
                              <span className="tabular-nums font-semibold">{field.value}%</span>
                            </FormLabel>
                            <FormControl>
                              <Slider
                                value={[field.value ?? 0]}
                                onValueChange={(v) => field.onChange(v[0])}
                                max={100}
                                step={5}
                                aria-label="Task progress"
                              />
                            </FormControl>
                            <FormDescription>
                              {field.value === 100
                                ? 'Setting 100% submits this task for review.'
                                : `It currently stands at ${currentProgress}%. Progress cannot go backward.`}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={form.formState.isSubmitting}>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {form.formState.isSubmitting ? 'Posting…' : 'Post update'}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>
                  Every update and review decision on this task, most recent first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {task.updates && task.updates.length > 0 ? (
                  <ol className="space-y-4">
                    {task.updates.map((update) => {
                      const author = userMap.get(update.authorId);

                      if (update.type === 'STATUS_CHANGE') {
                        const isApproval = update.text.includes('approved');
                        return (
                          <li key={update.id} className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                              {isApproval ? (
                                <CheckCircle className="h-6 w-6 text-success-strong" aria-hidden="true" />
                              ) : (
                                <XCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 rounded-md bg-muted/50 p-3 text-sm">
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold">
                                  {isApproval ? 'Approved' : 'Sent back for changes'}
                                </span>
                                <time
                                  dateTime={new Date(update.createdAt).toISOString()}
                                  className="text-xs text-muted-foreground"
                                >
                                  {formatDistanceToNow(new Date(update.createdAt), {
                                    addSuffix: true,
                                  })}
                                </time>
                              </div>
                              <p className="italic text-muted-foreground">{update.text}</p>
                            </div>
                          </li>
                        );
                      }

                      return (
                        <li key={update.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 shrink-0 border">
                            <AvatarImage src={author?.avatar ?? undefined} alt="" />
                            <AvatarFallback>{author?.name?.charAt(0) ?? '?'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 rounded-md bg-muted/50 p-3 text-sm">
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">{author?.name ?? 'Unknown'}</span>
                              <time
                                dateTime={new Date(update.createdAt).toISOString()}
                                className="text-xs text-muted-foreground"
                              >
                                {formatDistanceToNow(new Date(update.createdAt), {
                                  addSuffix: true,
                                })}
                              </time>
                            </div>
                            <p className="break-words">{update.text}</p>
                            {update.progressPercentage !== null && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Progress reported:{' '}
                                <span className="font-semibold tabular-nums">
                                  {update.progressPercentage}%
                                </span>
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <EmptyState
                    title="No updates yet"
                    description="Progress updates and review decisions will appear here as they happen."
                    compact
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.description ? (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No description was given.</p>
                )}

                <Separator />

                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Project</dt>
                    <dd className="min-w-0 truncate font-medium">{task.milestone.project.name}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Milestone</dt>
                    <dd className="min-w-0 truncate font-medium">{task.milestone.title}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <TaskStatusPill status={task.status} />
                    </dd>
                  </div>
                </dl>

                <Separator />

                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    Assignees{assignees.length > 0 ? ` (${assignees.length})` : ''}
                  </h3>
                  {assignees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nobody is assigned. Unassigned work does not appear in anyone&rsquo;s list.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {assignees.map((user) => (
                        <li key={user.id} className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border">
                            <AvatarImage src={user.avatar ?? undefined} alt="" />
                            <AvatarFallback>{user.name?.charAt(0) ?? '?'}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 truncate text-sm">{user.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />

                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold tabular-nums">{task.progress || 0}%</span>
                  </div>
                  <Progress
                    value={task.progress || 0}
                    aria-label={`Task progress: ${task.progress || 0}%`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageShell>

      {taskToDecline && (
        <DeclineTaskDialog
          isOpen={!!taskToDecline}
          onOpenChange={(open) => !open && setTaskToDecline(null)}
          task={taskToDecline}
          onDeclineConfirm={(reason) => handleDeclineConfirm(reason)}
        />
      )}
    </>
  );
}
