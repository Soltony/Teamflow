import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/lib/types';
import { teams, users } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Circle, CheckCircle2, CircleDot } from 'lucide-react';

type TaskListProps = {
  tasks: Task[];
};

const statusIcons = {
  todo: <Circle className="w-4 h-4 text-muted-foreground" />,
  'in-progress': <CircleDot className="w-4 h-4 text-blue-500" />,
  done: <CheckCircle2 className="w-4 h-4 text-green-500" />,
};

export function TaskList({ tasks }: TaskListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[80px]">Status</TableHead>
          <TableHead>Task</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Team Lead</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="text-right">Weight</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const team = teams.find(t => t.id === task.teamId);
          const teamLead = users.find(u => u.id === task.teamLeadId);
          return (
            <TableRow key={task.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {statusIcons[task.status]}
                  <span className="capitalize hidden md:inline-block">{task.status.replace('-', ' ')}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>
                <Badge variant="outline">{team?.name || 'N/A'}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={teamLead?.avatar} />
                    <AvatarFallback>{teamLead?.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{teamLead?.name}</span>
                </div>
              </TableCell>
              <TableCell>{format(new Date(task.endDate), 'MMM dd, yyyy')}</TableCell>
              <TableCell className="text-right">{task.weight}%</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
