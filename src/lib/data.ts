import type { User, Team, Project, Department, ProjectStatus } from './types';

export const users: User[] = [
  { id: 'user-1', name: 'Alice Johnson', avatar: 'https://i.pravatar.cc/150?u=user-1', phone: '123-456-7890' },
  { id: 'user-2', name: 'Bob Williams', avatar: 'https://i.pravatar.cc/150?u=user-2', phone: '234-567-8901' },
  { id: 'user-3', name: 'Charlie Brown', avatar: 'https://i.pravatar.cc/150?u=user-3', phone: '345-678-9012' },
  { id: 'user-4', name: 'Diana Miller', avatar: 'https://i.pravatar.cc/150?u=user-4', phone: '456-789-0123' },
  { id: 'user-5', name: 'Ethan Davis', avatar: 'https://i.pravatar.cc/150?u=user-5', phone: '567-890-1234' },
  { id: 'user-6', name: 'Fiona Garcia', avatar: 'https://i.pravatar.cc/150?u=user-6', phone: '678-901-2345' },
];

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

export const departments: Department[] = [
    { id: 'dept-1', name: 'Technology', responsible: { name: 'Dr. Evelyn Reed', title: 'CTO', phone: '111-222-3333' } },
    { id: 'dept-2', name: 'Marketing', responsible: { name: 'Marcus Holloway', title: 'CMO', phone: '444-555-6666' } },
];

export const projectStatuses: ProjectStatus[] = [
  { id: 'status-1', name: 'Active' },
  { id: 'status-2', name: 'Pending' },
  { id: 'status-3', name: 'Parked' },
  { id: 'status-4', name: 'Completed' },
];

export const projects: Project[] = [
  {
    id: 'proj-1',
    name: 'E-commerce Platform Relaunch',
    description: 'Complete overhaul of the existing e-commerce platform to improve user experience and performance.',
    startDate: '2024-08-01',
    endDate: '2024-11-30',
    workingYear: '2024/2025',
    statusId: 'status-1',
    departmentId: 'dept-1',
    projectManagerId: 'user-1',
    milestones: [
        {
            id: 'mile-1-1',
            title: 'Phase 1: Research & Design',
            description: 'Finalize user research, and create all wireframes and mockups.',
            startDate: '2024-08-01',
            dueDate: '2024-09-10',
            weight: 30,
            responsibleDepartmentIds: ['dept-2'],
            tasks: [
                { id: 'task-1-1', title: 'User Research & Analysis', description: 'Conduct user surveys and interviews to gather requirements.', status: 'done', startDate: '2024-08-01', endDate: '2024-08-15', weight: 40, assignedUserIds: ['user-5'] },
                { id: 'task-1-2', title: 'Design Wireframes & Mockups', description: 'Create high-fidelity mockups for the new platform.', status: 'in-progress', startDate: '2024-08-16', endDate: '2024-09-10', weight: 60, assignedUserIds: ['user-5', 'user-6'] },
            ]
        },
        {
            id: 'mile-1-2',
            title: 'Phase 2: Development',
            description: 'Complete frontend and backend development.',
            startDate: '2024-09-11',
            dueDate: '2024-10-31',
            weight: 60,
            responsibleDepartmentIds: ['dept-1'],
            tasks: [
                { id: 'task-1-3', title: 'Frontend Development', description: 'Develop the client-side of the application using Next.js.', status: 'pending-review', startDate: '2024-09-11', endDate: '2024-10-31', weight: 70, assignedUserIds: ['user-1', 'user-3'],
                  updates: [
                    { id: 'update-1', text: 'Initial component structure is complete. Starting on data binding.', userId: 'user-1', createdAt: '2024-10-15T10:00:00Z' },
                    { id: 'update-2', text: 'Data binding is done. Ready for review.', userId: 'user-1', createdAt: '2024-10-20T14:30:00Z' },
                  ]
                },
                { id: 'task-1-4', title: 'Backend Development', description: 'Build the server-side logic and database schema.', status: 'todo', startDate: '2024-09-11', endDate: '2024-10-31', weight: 30, assignedUserIds: ['user-2', 'user-4'] },
            ]
        },
        {
            id: 'mile-1-3',
            title: 'Phase 3: Deployment',
            description: 'Deploy the application and conduct QA.',
            startDate: '2024-11-01',
            dueDate: '2024-11-30',
            weight: 10,
            responsibleDepartmentIds: ['dept-1', 'dept-2'],
            tasks: [
                { id: 'task-1-5', title: 'Deployment & QA', description: 'Deploy the application and perform quality assurance testing.', status: 'todo', startDate: '2024-11-01', endDate: '2024-11-30', weight: 100, assignedUserIds: ['user-1', 'user-2', 'user-3'] },
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
    statusId: 'status-2',
    departmentId: 'dept-2',
    projectManagerId: 'user-2',
    milestones: [
        {
            id: 'mile-2-1',
            title: 'Initial Research and API',
            description: 'Market research and core API development.',
            startDate: '2024-09-01',
            dueDate: '2024-11-15',
            weight: 50,
            responsibleDepartmentIds: ['dept-1', 'dept-2'],
            tasks: [
                { id: 'task-2-1', title: 'Market Research', description: 'Analyze competitor apps and market trends.', status: 'done', startDate: '2024-09-01', endDate: '2024-09-15', weight: 30, assignedUserIds: ['user-4'] },
                { id: 'task-2-2', title: 'API Development', description: 'Develop REST APIs for the mobile app.', status: 'in-progress', startDate: '2024-09-16', endDate: '2024-11-15', weight: 70, assignedUserIds: ['user-2'] },
            ]
        },
        {
            id: 'mile-2-2',
            title: 'Mobile App Design and Development',
            description: 'UI/UX design and native app development.',
            startDate: '2024-11-16',
            dueDate: '2024-12-15',
            weight: 50,
            responsibleDepartmentIds: ['dept-1'],
            tasks: [
                { id: 'task-2-3', title: 'Mobile UI/UX Design', description: 'Design the user interface and experience for iOS and Android.', status: 'in-progress', startDate: '2024-09-16', endDate: '2024-10-15', weight: 40, assignedUserIds: ['user-5', 'user-6'] },
                { id: 'task-2-4', title: 'Mobile App Development', description: 'Develop the native mobile application.', status: 'todo', startDate: '2024-10-16', endDate: '2024-12-15', weight: 60, assignedUserIds: ['user-1', 'user-3'] },
            ]
        }
    ]
  },
  {
    id: 'proj-3',
    name: 'Data Analytics Dashboard Q1',
    description: 'Implementation of a new data analytics dashboard for the marketing team.',
    startDate: '2025-01-15',
    endDate: '2025-03-31',
    workingYear: '2024/2025',
    statusId: 'status-1',
    departmentId: 'dept-2',
    projectManagerId: 'user-4',
    milestones: [
        {
            id: 'mile-3-1',
            title: 'Q1: Data Source Integration',
            description: 'Connect to all required data sources.',
            startDate: '2025-01-15',
            dueDate: '2025-02-15',
            weight: 50,
            responsibleDepartmentIds: ['dept-1'],
            tasks: [
                { id: 'task-3-1', title: 'Integrate CRM Data', description: 'Pull customer data from the CRM.', status: 'in-progress', startDate: '2025-01-15', endDate: '2025-01-31', weight: 100, assignedUserIds: ['user-2'] },
            ]
        },
        {
            id: 'mile-3-2',
            title: 'Q1: Dashboard UI/UX',
            description: 'Design and implement the dashboard user interface.',
            startDate: '2025-02-16',
            dueDate: '2025-03-31',
            weight: 50,
            responsibleDepartmentIds: ['dept-2'],
            tasks: [
                 { id: 'task-3-2', title: 'Design Dashboard Mockups', description: 'Create mockups for all dashboard views.', status: 'todo', startDate: '2025-02-01', endDate: '2025-02-28', weight: 50, assignedUserIds: ['user-5', 'user-6'] },
                 { id: 'task-3-3', title: 'Develop UI Components', description: 'Build the React components for the dashboard.', status: 'todo', startDate: '2025-03-01', endDate: '2025-03-31', weight: 50, assignedUserIds: ['user-1', 'user-3'] },
            ]
        }
    ]
  },
  {
    id: 'proj-4',
    name: 'Annual Company Offsite Planning',
    description: 'Organize and plan the annual company-wide offsite event.',
    startDate: '2025-08-01',
    endDate: '2025-10-31',
    workingYear: '2025/2026',
    statusId: 'status-2',
    departmentId: 'dept-2',
    projectManagerId: 'user-6',
    milestones: [
      {
        id: 'mile-4-1',
        title: 'Venue and Logistics',
        description: 'Finalize venue, travel, and accommodation.',
        startDate: '2025-08-01',
        dueDate: '2025-09-15',
        weight: 100,
        responsibleDepartmentIds: ['dept-2'],
        tasks: [
          { id: 'task-4-1', title: 'Venue Selection', description: 'Research and book the event venue.', status: 'todo', startDate: '2025-08-01', endDate: '2025-08-31', weight: 100, assignedUserIds: ['user-6'] },
        ]
      }
    ]
  }
];
