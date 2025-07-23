
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Task, TaskStatus } from '@/lib/types';
import { format, isPast, parseISO } from 'date-fns';
import { Circle, CheckCircle2, CircleDot, AlertTriangle, Pencil, FileClock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type TaskListProps = {
  tasks: Task[];
  users: any[];
  onEditTask: (task: Task) => void;
  canManageTasks: boolean;
};

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  TODO: <Circle className="w-4 h-4 text-muted-foreground" />,
  IN_PROGRESS: <CircleDot className="w-4 h-4 text-blue-500" />,
  PENDING_REVIEW: <FileClock className="w-4 h-4 text-amber-500" />,
  DONE: <CheckCircle2 className="w-4 h-4 text-green-500" />,
};

const formatStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ').toLowerCase();

export function TaskList({ tasks, onEditTask, users, canManageTasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
        <p>No tasks have been added to this milestone yet.</p>
        <p className="text-sm">Click "Add Task" to get started.</p>
      </div>
    );
  }

  const userMap = new Map(users.map(u => [u.id, u.name]));
  
  const sortedTasks = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Assignees</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            <TableHead className="w-[50px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => {
            const isOverdue = isPast(parseISO(task.endDate)) && task.status !== 'DONE';
            return (
              <TableRow key={task.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {statusIcons[task.status]}
                    <span className="capitalize hidden md:inline-block">{formatStatus(task.status)}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {task.assignedUserIds
                      .map(userId => userMap.get(userId))
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </TableCell>
                <TableCell>
                  <div className={cn("flex items-center gap-1.5", isOverdue && "text-destructive")}>
                    <span>{format(parseISO(task.endDate), 'MMM dd, yyyy')}</span>
                    {isOverdue && (
                      <Tooltip>
                          <TooltipTrigger>
                              <AlertTriangle className="w-4 h-4" />
                          </TooltipTrigger>
                          <TooltipContent>
                              <p>This task is overdue.</p>
                          </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">{task.weight}%</TableCell>
                <TableCell className="text-right">
                  {canManageTasks && (
                    <Button variant="ghost" size="icon" onClick={() => onEditTask(task)}>
                      <Pencil className="w-4 h-4" />
                      <span className="sr-only">Edit Task</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
