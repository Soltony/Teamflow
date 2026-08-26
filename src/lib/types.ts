
export type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

export type User = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Null for users who have never set one; the UI falls back to initials. */
  avatar?: string | null;
  phoneNumber?: string | null;
  roles?: Role[];
  pmoDivisionId?: string | null;
  departmentId?: string | null;
};

/**
 * A user loaded together with their roles.
 *
 * Ten components each declared their own version of this, which is why the page
 * state and the component props kept disagreeing: `User.roles` is optional
 * (not every query selects it) while anything doing a role check needs it
 * present. Use this type wherever roles are actually required, and it will be
 * a compile error to pass a user that was loaded without them.
 */
export type UserWithRoles = User & { roles: Role[] };

/**
 * The subset of a user needed to show who someone is.
 *
 * Queries that feed avatars, assignee pickers and mention lists select only
 * these fields, rather than shipping every colleague's phone number and
 * password metadata to the browser. Components that merely display a person
 * should ask for this, not for the whole record.
 */
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
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
  progressPercentage: number | null;
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
  progress: number;
  /** The milestone this task hangs off. Always present; see services/milestones.ts. */
  milestoneId: string;
  assignedUserIds: string[];
  updates?: TaskUpdate[];
  completedAt?: string | null;
  createdAt: string;
};

export type Milestone = {
    id: string;
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    weight: number;
    tasks: Task[];
    createdAt: string;
};

export type Department = {
    id:string;
    name: string;
};

export type PmoDivision = {
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

export type BlockerStatus = 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
export type BlockerSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BlockerCategory =
  | 'RESOURCE'
  | 'TECHNICAL'
  | 'VENDOR'
  | 'FINANCIAL'
  | 'DEPENDENCY'
  | 'REGULATORY'
  | 'SCOPE'
  | 'OTHER';

/**
 * An issue blocking a project, as the browser sees it.
 *
 * Dates are strings here: this is the shape after the value has crossed the
 * server/client boundary.
 */
export type Blocker = {
  id: string;
  title: string;
  description: string;
  category: BlockerCategory;
  severity: BlockerSeverity;
  status: BlockerStatus;
  impact?: string | null;
  dueDate?: string | null;
  ownerId?: string | null;
  owner?: { id: string; name: string } | null;
  raisedById?: string | null;
  raisedBy?: { id: string; name: string } | null;
  resolvedById?: string | null;
  escalatedToId?: string | null;
  escalatedTo?: { id: string; name: string } | null;
  escalatedAt?: string | null;
  escalationReason?: string | null;
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
  pmoDivisionId: string;
  projectManagerId: string;
  workingYear: string;
  responsibleDepartmentIds: string[];
  milestones: Milestone[];
  blockers?: Blocker[];
};
