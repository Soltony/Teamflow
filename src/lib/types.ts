export type User = {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
};

export type Team = {
  id: string;
  name: string;
  projectId: string;
  teamLeadId: string;
  memberIds: string[];
};

export type TaskUpdate = {
  id: string;
  text: string;
  userId: string;
  createdAt: string;
  type?: 'comment' | 'status-change';
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'pending-review' | 'done';
  startDate: string;
  endDate: string;
  weight: number;
  assignedUserIds: string[];
  updates?: TaskUpdate[];
  completedAt?: string;
};

export type Milestone = {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    weight: number;
    tasks: Task[];
    responsibleDepartmentIds: string[];
};

export type Department = {
    id:string;
    name: string;
    responsible: {
        name: string;
        title: string;
        phone: string;
    };
};

export type ProjectStatus = {
  id: string;
  name: string;
};

export type Blocker = {
  id: string;
  description: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
};

export type Project = {
  id: string;
  name:string;
  description: string;
  startDate: string;
  endDate: string;
  statusId: string;
  departmentId: string;
  projectManagerId: string;
  workingYear: string;
  milestones: Milestone[];
  blockers?: Blocker[];
};
