
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Task } from '@/lib/types';
import { users } from '@/lib/data';
import { format, isPast } from 'date-fns';
import { Circle, CheckCircle2, CircleDot, AlertTriangle, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type TaskListProps = {
  tasks: Task[];
  onEditTask: (task: Task) => void;
};

const statusIcons = {
  todo: <Circle className="w-4 h-4 text-muted-foreground" />,
  'in-progress': <CircleDot className="w-4 h-4 text-blue-500" />,
  done: <CheckCircle2 className="w-4 h-4 text-green-500" />,
};

export function TaskList({ tasks, onEditTask }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
        <p>No tasks have been added to this milestone yet.</p>
        <p className="text-sm">Click "Add Task" to get started.</p>
      </div>
    );
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
          {tasks.map((task) => {
            const isOverdue = isPast(new Date(task.endDate)) && task.status !== 'done';
            return (
              <TableRow key={task.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {statusIcons[task.status]}
                    <span className="capitalize hidden md:inline-block">{capitalize(task.status.replace('-', ' '))}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {task.assignedUserIds
                      .map(userId => users.find(u => u.id === userId)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </TableCell>
                <TableCell>
                  <div className={cn("flex items-center gap-1.5", isOverdue && "text-destructive")}>
                    <span>{format(new Date(task.endDate), 'MMM dd, yyyy')}</span>
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
                  <Button variant="ghost" size="icon" onClick={() => onEditTask(task)}>
                    <Pencil className="w-4 h-4" />
                    <span className="sr-only">Edit Task</span>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
