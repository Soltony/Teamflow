export type User = {
  id: string;
  name: string;
  avatar: string;
};

export type Team = {
  id: string;
  name: string;
  members: User[];
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  startDate: string;
  endDate: string;
  weight: number;
  teamId: string;
  teamLeadId: string;
};

export type Project = {
  id: string;
  name:string;
  description: string;
  startDate: string;
  endDate: string;
  tasks: Task[];
};
