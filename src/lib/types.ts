
export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phoneNumber?: string;
};

export type Team = {
  id: string;
  name: string;
  projectId: string;
  teamLeadId: string;
  memberIds: string[];
};

export type TaskUpdateType = 'COMMENT' | 'STATUS_CHANGE';

export type TaskUpdate = {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  type: TaskUpdateType;
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'DONE';

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  startDate: string;
  endDate: string;
  weight: number;
  assignedUserIds: string[];
  updates?: TaskUpdate[];
  completedAt?: string | null;
};

export type Milestone = {
    id: string;
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    weight: number;
    tasks: Task[];
    responsibleDepartmentIds: string[];
};

export type Department = {
    id:string;
    name: string;
    responsibleName: string;
    responsibleTitle: string;
    responsiblePhone: string;
};

export type ProjectStatus = {
  id: string;
  name: string;
};

export type BlockerStatus = 'OPEN' | 'RESOLVED';

export type Blocker = {
  id: string;
  description: string;
  status: BlockerStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolution?: string | null;
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
