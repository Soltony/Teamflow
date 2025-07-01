
import type { User, Team, Project, Department, ProjectStatus, Task, Milestone, TaskUpdate, Blocker } from './types';

export const users: User[] = [
  { id: 'user-1', name: 'Alice Johnson', email: 'alice.johnson@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-1', phone: '123-456-7890' },
  { id: 'user-2', name: 'Bob Williams', email: 'bob.williams@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-2', phone: '234-567-8901' },
  { id: 'user-3', name: 'Charlie Brown', email: 'charlie.brown@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-3', phone: '345-678-9012' },
  { id: 'user-4', name: 'Diana Miller', email: 'diana.miller@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-4', phone: '456-789-0123' },
  { id: 'user-5', name: 'Ethan Davis', email: 'ethan.davis@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-5', phone: '567-890-1234' },
  { id: 'user-6', name: 'Fiona Garcia', email: 'fiona.garcia@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-6', phone: '678-901-2345' },
];

export const departments: Omit<Department, 'id'>[] = [
    { name: 'Technology', responsible: { name: 'Dr. Evelyn Reed', title: 'CTO', phone: '111-222-3333' } },
    { name: 'Marketing', responsible: { name: 'Marcus Holloway', title: 'CMO', phone: '444-555-6666' } },
];

export const projectStatuses: Omit<ProjectStatus, 'id'>[] = [
  { name: 'Active' },
  { name: 'Pending' },
  { name: 'Parked' },
  { name: 'Completed' },
];

const tempProjects: any[] = [
  {
    id: 'proj-1',
    name: 'E-commerce Platform Relaunch',
    description: 'Complete overhaul of the existing e-commerce platform to improve user experience and performance.',
    startDate: '2024-08-01',
    endDate: '2024-11-30',
    workingYear: '2024/2025',
    statusName: 'Active',
    departmentName: 'Technology',
    projectManagerEmail: 'alice.johnson@teamflow.com',
    milestones: [
        {
            id: 'mile-1-1',
            title: 'Phase 1: Research & Design',
            description: 'Finalize user research, and create all wireframes and mockups.',
            startDate: '2024-08-01',
            dueDate: '2024-09-10',
            weight: 30,
            responsibleDepartmentNames: ['Marketing'],
            tasks: [
                { id: 'task-1-1', title: 'User Research & Analysis', description: 'Conduct user surveys and interviews to gather requirements.', status: 'done', startDate: '2024-08-01', endDate: '2024-08-15', weight: 40, assignedUserEmails: ['ethan.davis@teamflow.com'] },
                { id: 'task-1-2', title: 'Design Wireframes & Mockups', description: 'Create high-fidelity mockups for the new platform.', status: 'in-progress', startDate: '2024-08-16', endDate: '2024-09-10', weight: 60, assignedUserEmails: ['ethan.davis@teamflow.com', 'fiona.garcia@teamflow.com'] },
            ]
        },
        {
            id: 'mile-1-2',
            title: 'Phase 2: Development',
            description: 'Complete frontend and backend development.',
            startDate: '2024-09-11',
            dueDate: '2024-10-31',
            weight: 60,
            responsibleDepartmentNames: ['Technology'],
            tasks: [
                { id: 'task-1-3', title: 'Frontend Development', description: 'Develop the client-side of the application using Next.js.', status: 'pending-review', startDate: '2024-09-11', endDate: '2024-10-31', weight: 70, assignedUserEmails: ['alice.johnson@teamflow.com', 'charlie.brown@teamflow.com'],
                  updates: [
                    { id: 'update-1', text: 'Initial component structure is complete. Starting on data binding.', userEmail: 'alice.johnson@teamflow.com', createdAt: '2024-10-15T10:00:00Z' },
                    { id: 'update-2', text: 'Data binding is done. Ready for review.', userEmail: 'alice.johnson@teamflow.com', createdAt: '2024-10-20T14:30:00Z' },
                  ]
                },
                { id: 'task-1-4', title: 'Backend Development', description: 'Build the server-side logic and database schema.', status: 'todo', startDate: '2024-09-11', endDate: '2024-10-31', weight: 30, assignedUserEmails: ['bob.williams@teamflow.com', 'diana.miller@teamflow.com'] },
            ]
        },
        {
            id: 'mile-1-3',
            title: 'Phase 3: Deployment',
            description: 'Deploy the application and conduct QA.',
            startDate: '2024-11-01',
            dueDate: '2024-11-30',
            weight: 10,
            responsibleDepartmentNames: ['Technology', 'Marketing'],
            tasks: [
                { id: 'task-1-5', title: 'Deployment & QA', description: 'Deploy the application and perform quality assurance testing.', status: 'todo', startDate: '2024-11-01', endDate: '2024-11-30', weight: 100, assignedUserEmails: ['alice.johnson@teamflow.com', 'bob.williams@teamflow.com', 'charlie.brown@teamflow.com'] },
            ]
        }
    ],
    blockers: [
        {
            id: 'blocker-1',
            description: 'The third-party payment gateway API is not providing the expected responses for international transactions.',
            status: 'open',
            createdAt: '2024-10-25',
        },
        {
            id: 'blocker-2',
            description: 'Design team has not finalized the new logo, which is blocking the creation of marketing materials.',
            status: 'resolved',
            createdAt: '2024-10-20',
            resolvedAt: '2024-10-22',
            resolution: 'An emergency meeting was held with the design team and stakeholders. A final logo was approved and delivered.'
        }
    ]
  },
  {
    id: 'proj-2',
    name: 'Mobile App for Task Management',
    description: 'A new mobile application for users to manage their daily tasks and improve productivity.',
    startDate: '2024-09-01',
    endDate: '2024-12-31',
    workingYear: '2024/2025',
    statusName: 'Pending',
    departmentName: 'Technology',
    projectManagerEmail: 'bob.williams@teamflow.com',
    milestones: [
        {
            id: 'mile-2-1',
            title: 'Initial Research and API',
            description: 'Market research and core API development.',
            startDate: '2024-09-01',
            dueDate: '2024-11-15',
            weight: 50,
            responsibleDepartmentNames: ['Technology', 'Marketing'],
            tasks: [
                { id: 'task-2-1', title: 'Market Research', description: 'Analyze competitor apps and market trends.', status: 'done', startDate: '2024-09-01', endDate: '2024-09-15', weight: 30, assignedUserEmails: ['diana.miller@teamflow.com'] },
                { id: 'task-2-2', title: 'API Development', description: 'Develop REST APIs for the mobile app.', status: 'in-progress', startDate: '2024-09-16', endDate: '2024-11-15', weight: 70, assignedUserEmails: ['bob.williams@teamflow.com'] },
            ]
        },
        {
            id: 'mile-2-2',
            title: 'Mobile App Design and Development',
            description: 'UI/UX design and native app development.',
            startDate: '2024-11-16',
            dueDate: '2024-12-15',
            weight: 50,
            responsibleDepartmentNames: ['Technology'],
            tasks: [
                { id: 'task-2-3', title: 'Mobile UI/UX Design', description: 'Design the user interface and experience for iOS and Android.', status: 'in-progress', startDate: '2024-09-16', endDate: '2024-10-15', weight: 40, assignedUserEmails: ['ethan.davis@teamflow.com', 'fiona.garcia@teamflow.com'] },
                { id: 'task-2-4', title: 'Mobile App Development', description: 'Develop the native mobile application.', status: 'todo', startDate: '2024-10-16', endDate: '2024-12-15', weight: 60, assignedUserEmails: ['alice.johnson@teamflow.com', 'charlie.brown@teamflow.com'] },
            ]
        }
    ]
  },
];

const userMap = new Map(users.map(u => [u.email, u.id]));
const departmentMap = new Map(departments.map((d, i) => [d.name, `dept-${i+1}`]));
const statusMap = new Map(projectStatuses.map((s, i) => [s.name, `status-${i+1}`]));

departments.forEach((d, i) => { (d as any).id = `dept-${i+1}` });
projectStatuses.forEach((s, i) => { (s as any).id = `status-${i+1}` });


export const projects: Project[] = tempProjects.map(p => ({
  ...p,
  statusId: statusMap.get(p.statusName)!,
  departmentId: departmentMap.get(p.departmentName)!,
  projectManagerId: userMap.get(p.projectManagerEmail)!,
  milestones: p.milestones.map((m:any) => ({
    ...m,
    responsibleDepartmentIds: m.responsibleDepartmentNames.map((name:string) => departmentMap.get(name)!),
    tasks: m.tasks.map((t:any) => ({
      ...t,
      assignedUserIds: t.assignedUserEmails.map((email:string) => userMap.get(email)!),
      updates: t.updates?.map((u:any) => ({
        ...u,
        authorId: userMap.get(u.userEmail)!,
      }))
    }))
  }))
}));

export const teams: Team[] = [
  { 
    id: 'team-1', 
    name: 'Frontend Wizards', 
    projectId: 'proj-1', 
    teamLeadId: 'user-1', 
    memberIds: ['user-1', 'user-3'] 
  },
  { 
    id: 'team-2', 
    name: 'Backend Titans', 
    projectId: 'proj-1', 
    teamLeadId: 'user-2', 
    memberIds: ['user-2', 'user-4'] 
  },
  { 
    id: 'team-3', 
    name: 'Marketing Squad', 
    projectId: 'proj-2', 
    teamLeadId: 'user-4', 
    memberIds: ['user-4', 'user-6'] 
  },
];
