
"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Project, Milestone, Task, User, TaskUpdate } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle } from "lucide-react";

type MyTasksManagementProps = {
  allProjects: Project[];
  allUsers: User[];
  currentUser: User;
};

type UserTask = Task & {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
};

const taskUpdateSchema = z.object({
  text: z.string().min(10, "Update must be at least 10 characters.").max(500, "Update cannot exceed 500 characters."),
});

type TaskUpdateFormValues = z.infer<typeof taskUpdateSchema>;

const taskStatuses: Task['status'][] = ['todo', 'in-progress', 'pending-review', 'done'];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MyTasksManagement({ allProjects, allUsers, currentUser }: MyTasksManagementProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>(allProjects);
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

  const form = useForm<TaskUpdateFormValues>({
    resolver: zodResolver(taskUpdateSchema),
    defaultValues: { text: "" },
  });

  const myTasks = useMemo(() => {
    const tasks: UserTask[] = [];
    projects.forEach(project => {
      project.milestones.forEach(milestone => {
        milestone.tasks.forEach(task => {
          if (task.assignedUserIds.includes(currentUser.id)) {
            tasks.push({
              ...task,
              projectId: project.id,
              projectName: project.name,
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
            });
          }
        });
      });
    });
    return tasks.reduce((acc, task) => {
        if (!acc[task.projectName]) {
            acc[task.projectName] = [];
        }
        acc[task.projectName].push(task);
        return acc;
    }, {} as Record<string, UserTask[]>);
  }, [projects, currentUser.id]);

  const handleStatusChange = (taskId: string, milestoneId: string, projectId: string, newStatus: Task['status']) => {
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === projectId
          ? {
              ...p,
              milestones: p.milestones.map(m =>
                m.id === milestoneId
                  ? {
                      ...m,
                      tasks: m.tasks.map(t =>
                        t.id === taskId ? { ...t, status: newStatus } : t
                      ),
                    }
                  : m
              ),
            }
          : p
      )
    );
    toast({
        title: "Status Updated",
        description: `Task status has been changed to "${capitalize(newStatus.replace('-', ' '))}".`
    })
  };

  const handleUpdateSubmit = (taskId: string, milestoneId: string, projectId: string, data: TaskUpdateFormValues) => {
    const newUpdate: TaskUpdate = {
        id: `update-${Date.now()}`,
        text: data.text,
        userId: currentUser.id,
        createdAt: new Date().toISOString(),
        type: 'comment',
    };

    setProjects(prevProjects =>
        prevProjects.map(p =>
          p.id === projectId
            ? {
                ...p,
                milestones: p.milestones.map(m =>
                  m.id === milestoneId
                    ? {
                        ...m,
                        tasks: m.tasks.map(t =>
                          t.id === taskId ? { ...t, updates: [...(t.updates || []), newUpdate] } : t
                        ),
                      }
                    : m
                ),
              }
            : p
        )
      );

      toast({
          title: "Update Added",
          description: "Your progress update has been recorded."
      });
      form.reset();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
          <CardDescription>
            A centralized view of all tasks assigned to you across all projects.
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="multiple" className="w-full space-y-4" defaultValue={Object.keys(myTasks)}>
        {Object.entries(myTasks).map(([projectName, tasks]) => (
          <AccordionItem value={projectName} key={projectName} className="border rounded-lg bg-card">
            <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
              {projectName}
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
              <div className="space-y-4">
                {tasks.map(task => (
                  <Card key={task.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start gap-4">
                        <div>
                            <CardTitle className="text-xl">{task.title}</CardTitle>
                            <CardDescription>In Milestone: {task.milestoneTitle}</CardDescription>
                        </div>
                        <div className="w-48">
                            <Select 
                                value={task.status} 
                                onValueChange={(newStatus: Task['status']) => handleStatusChange(task.id, task.milestoneId, task.projectId, newStatus)}
                                disabled={task.status === 'done'}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                {taskStatuses.map(status => (
                                    <SelectItem key={status} value={status} disabled={status === 'done'}>
                                        {capitalize(status.replace('-', ' '))}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                            <Badge variant="outline">Due: {format(new Date(task.endDate), 'MMM dd, yyyy')}</Badge>
                            <Badge variant="secondary">Weight: {task.weight}%</Badge>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-semibold mb-2">Updates</h4>
                            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                                {task.updates && task.updates.length > 0 ? (
                                    task.updates.slice().reverse().map(update => {
                                        const author = userMap.get(update.userId);
                                        
                                        if (update.type === 'status-change') {
                                            const isApproval = update.text.includes('approved');
                                            return (
                                                <div key={update.id} className="flex items-start gap-3">
                                                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                                        {isApproval ? (
                                                            <CheckCircle className="w-6 h-6 text-green-500" />
                                                        ) : (
                                                            <XCircle className="w-6 h-6 text-destructive" />
                                                        )}
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
                                                    <AvatarImage src={author?.avatar} alt={author?.name} />
                                                    <AvatarFallback>{author?.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 text-sm bg-muted/50 p-3 rounded-md">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold">{author?.name}</span>
                                                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}</span>
                                                    </div>
                                                    <p>{update.text}</p>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : <p className="text-sm text-muted-foreground">No updates posted yet.</p>}
                            </div>
                        </div>
                        <div>
                             {task.status === 'done' ? (
                                <div className="text-sm text-green-700 font-medium p-3 bg-green-50 rounded-md border border-green-200 mt-4 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                    This task has been completed and approved. No further updates can be made.
                                </div>
                            ) : (
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit((data) => handleUpdateSubmit(task.id, task.milestoneId, task.projectId, data))} className="space-y-2 mt-4">
                                        <FormField
                                        control={form.control}
                                        name="text"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="sr-only">Add Update</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Post a new update..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <Button type="submit" size="sm">Post Update</Button>
                                    </form>
                                </Form>
                            )}
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {Object.keys(myTasks).length === 0 && (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-semibold">No tasks assigned to you!</p>
            <p>Your task list is empty. Enjoy the peace and quiet.</p>
        </div>
      )}
    </div>
  );
}
