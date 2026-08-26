

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getTaskDetails, type TaskDetails } from './actions';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, Target, Award, User as UserIcon, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { addTaskUpdateAction } from '@/app/my-tasks/actions';
import { approveTaskAction, declineTaskAction } from '@/app/team-view/actions';
import { DeclineTaskDialog } from '@/components/tasks/decline-task-dialog';
import type { TeamViewTask } from '@/app/team-view/page';
import { useFirstLoad } from "@/hooks/use-first-load";


function LoadingSkeleton() {
  return (
    <LoadingRegion label="Loading task">
      <div className="p-4 sm:p-6 space-y-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-64 w-full" />
              </div>
              <div className="space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
          </div>
      </div>
    </LoadingRegion>
  )
}

const taskUpdateSchema = (taskProgress: number) => z.object({
  text: z.string().min(10, "Update must be at least 10 characters.").max(500, "Update cannot exceed 500 characters."),
  progressPercentage: z.number().min(taskProgress, `Progress cannot go backward. Current is ${taskProgress}%.`).max(100, "Progress cannot exceed 100%."),
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
    const [taskToDecline, setTaskToDecline] = useState<TeamViewTask | null>(null);

    const fetchTask = useCallback(async () => {
        if (localUser?.id && taskId) {
            setIsLoading(true);
            try {
                const taskData = await getTaskDetails(taskId, localUser.id);
                if (taskData) {
                    setData(taskData);
                } else {
                    toast({ title: "Not Found", description: "Task not found or you don't have permission to view it.", variant: "destructive"});
                    router.replace('/dashboard');
                }
            } catch (error) {
                toast({ title: "Error", description: "Failed to fetch task details.", variant: "destructive"});
            } finally {
                setIsLoading(false);
            }
        }
    }, [localUser?.id, taskId, router, toast]);

    useEffect(() => {
        if (!authLoading) {
            fetchTask();
        }
    }, [authLoading, fetchTask]);
  
    const { task, allUsers } = data || {};
    const userMap = useMemo(() => new Map(allUsers?.map(u => [u.id, u])), [allUsers]);

    const currentProgress = task?.progress ?? 0;
    const form = useForm<TaskUpdateFormValues>({
        resolver: zodResolver(taskUpdateSchema(currentProgress)),
        defaultValues: { text: "", progressPercentage: currentProgress },
    });

    const isTeamLeadOrManager = localUser?.roles.some(role => 
        role.permissions.includes('projects:read') && 
        role.permissions.includes('projects:update') && 
        role.permissions.includes('projects:delete')
    );

    const handleUpdateSubmit = async (formData: TaskUpdateFormValues) => {
        if (!task || !localUser) return;
        if (formData.progressPercentage === currentProgress) {
            toast({
                title: "Progress Not Changed",
                description: "You must change the progress slider to post an update.",
                variant: "destructive",
            });
            return;
        }

        const result = await addTaskUpdateAction(task.id, formData.text, localUser.id, formData.progressPercentage);
        if (result.success) {
            toast({ title: "Update Added", description: "Your progress update has been recorded." });
            await fetchTask();
            form.reset({ text: "", progressPercentage: formData.progressPercentage });
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    };
    
    const handleApprove = async () => {
        if (!task || !localUser) return;
        const result = await approveTaskAction(task.id, localUser.id, localUser.name);
        if (result.success) {
            toast({ title: "Task Approved", description: `"${task.title}" has been marked as Done.` });
            await fetchTask();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    };

    const handleDeclineConfirm = async (reason: string) => {
        if (!task || !localUser) return;
        const result = await declineTaskAction(task.id, localUser.id, localUser.name, reason);
        if (result.success) {
            toast({ title: "Task Declined", description: `"${task.title}" has been sent back to In Progress.`, variant: 'destructive' });
            await fetchTask();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
        setTaskToDecline(null);
    };

    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading || !task) {
        return <LoadingSkeleton />;
    }

    const assignees = task.assignedUserIds
        .map((id: string) => userMap.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u));

    const isPendingReview = task.status === 'PENDING_REVIEW';
    const canReview = isPendingReview && isTeamLeadOrManager;
    const canUpdate = task.status !== 'DONE' && !canReview;

    return (
        <>
            <div className="p-4 sm:p-6 space-y-6">
                <Link href={`/projects/${task.milestone.project.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Project
                </Link>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                         <Card>
                            <CardHeader>
                                <CardTitle className="text-2xl">{task.title}</CardTitle>
                                <CardDescription>In Project: <Link href={`/projects/${task.milestone.project.id}`} className="hover:underline text-primary">{task.milestone.project.name}</Link> / {task.milestone.title}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">{task.description}</p>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader><CardTitle>Updates</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                     {task.updates && task.updates.length > 0 ? (
                                        task.updates.map(update => {
                                            const author = userMap.get(update.authorId);
                                            
                                            if (update.type === 'STATUS_CHANGE') {
                                                const isApproval = update.text.includes('approved');
                                                return (
                                                    <div key={update.id} className="flex items-start gap-3">
                                                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                                            {isApproval ? <CheckCircle className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-destructive" />}
                                                        </div>
                                                        <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-semibold">{isApproval ? 'Task Approved' : 'Task Declined'}</span>
                                                                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</span>
                                                            </div>
                                                            <p className="text-muted-foreground italic">{update.text}</p>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={update.id} className="flex items-start gap-3">
                                                    <Avatar className="w-8 h-8 border">
                                                        <AvatarImage src={author?.avatar ?? undefined} alt={author?.name} />
                                                        <AvatarFallback>{author?.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="font-semibold">{author?.name}</span>
                                                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</span>
                                                        </div>
                                                        <p>{update.text}</p>
                                                        {update.progressPercentage !== null && (
                                                          <div className="mt-2 text-xs text-muted-foreground">Progress reported: <span className="font-bold">{update.progressPercentage}%</span></div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : <p className="text-sm text-muted-foreground">No updates posted yet.</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Progress</span>
                                        <span className="font-semibold">{task.progress || 0}%</span>
                                    </div>
                                    <Progress value={task.progress || 0} />
                                </div>
                                <div className="text-sm space-y-2">
                                    <div className="flex justify-between"><span>Status:</span> <Badge variant="secondary">{task.status.replace(/_/g, ' ')}</Badge></div>
                                    <div className="flex justify-between"><span>Due Date:</span> <span>{format(new Date(task.endDate), 'MMM dd, yyyy')}</span></div>
                                    <div className="flex justify-between"><span>Weight:</span> <span>{task.weight}%</span></div>
                                </div>
                                <Separator />
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Assignees</h4>
                                    <div className="space-y-2">
                                        {assignees.map(user => (
                                            <div key={user.id} className="flex items-center gap-2">
                                                <Avatar className="w-6 h-6 border">
                                                    <AvatarImage src={user?.avatar ?? undefined} />
                                                    <AvatarFallback>{user?.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm">{user?.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {canUpdate && (
                            <Card>
                                <CardHeader><CardTitle>Post an Update</CardTitle></CardHeader>
                                <CardContent>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(handleUpdateSubmit)} className="space-y-4">
                                            <FormField control={form.control} name="text" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="sr-only">New Update</FormLabel>
                                                    <FormControl><Textarea placeholder="Describe your progress..." {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                            <FormField control={form.control} name="progressPercentage" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Task Progress: {field.value}%</FormLabel>
                                                    <FormControl><Slider value={[field.value ?? 0]} onValueChange={(v) => field.onChange(v[0])} max={100} step={5} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                            <Button type="submit" className="w-full">Post Update</Button>
                                        </form>
                                    </Form>
                                </CardContent>
                            </Card>
                        )}
                        
                        {canReview && (
                             <Card>
                                <CardHeader><CardTitle>Review Task</CardTitle></CardHeader>
                                <CardContent className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setTaskToDecline(task as unknown as TeamViewTask)}>
                                        <XCircle className="mr-2 h-4 w-4" /> Decline
                                    </Button>
                                    <Button onClick={handleApprove}>
                                        <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
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
