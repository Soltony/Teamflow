import type { User, Team, Project } from './types';

export const users: User[] = [
  { id: 'user-1', name: 'Alice Johnson', avatar: 'https://i.pravatar.cc/150?u=user-1' },
  { id: 'user-2', name: 'Bob Williams', avatar: 'https://i.pravatar.cc/150?u=user-2' },
  { id: 'user-3', name: 'Charlie Brown', avatar: 'https://i.pravatar.cc/150?u=user-3' },
  { id: 'user-4', name: 'Diana Miller', avatar: 'https://i.pravatar.cc/150?u=user-4' },
  { id: 'user-5', name: 'Ethan Davis', avatar: 'https://i.pravatar.cc/150?u=user-5' },
  { id: 'user-6', name: 'Fiona Garcia', avatar: 'https://i.pravatar.cc/150?u=user-6' },
];

export const teams: Team[] = [
  { id: 'team-1', name: 'Frontend Wizards', members: [users[0], users[2]] },
  { id: 'team-2', name: 'Backend Titans', members: [users[1], users[3]] },
  { id: 'team-3', name: 'Design Gurus', members: [users[4], users[5]] },
];

export const projects: Project[] = [
  {
    id: 'proj-1',
    name: 'E-commerce Platform Relaunch',
    description: 'Complete overhaul of the existing e-commerce platform to improve user experience and performance.',
    startDate: '2024-08-01',
    endDate: '2024-11-30',
    tasks: [
      { id: 'task-1-1', title: 'User Research & Analysis', description: 'Conduct user surveys and interviews to gather requirements.', status: 'done', startDate: '2024-08-01', endDate: '2024-08-15', weight: 10, teamId: 'team-3', teamLeadId: 'user-5' },
      { id: 'task-1-2', title: 'Design Wireframes & Mockups', description: 'Create high-fidelity mockups for the new platform.', status: 'in-progress', startDate: '2024-08-16', endDate: '2024-09-10', weight: 20, teamId: 'team-3', teamLeadId: 'user-5' },
      { id: 'task-1-3', title: 'Frontend Development', description: 'Develop the client-side of the application using Next.js.', status: 'in-progress', startDate: '2024-09-11', endDate: '2024-10-31', weight: 40, teamId: 'team-1', teamLeadId: 'user-1' },
      { id: 'task-1-4', title: 'Backend Development', description: 'Build the server-side logic and database schema.', status: 'todo', startDate: '2024-09-11', endDate: '2024-10-31', weight: 20, teamId: 'team-2', teamLeadId: 'user-2' },
      { id: 'task-1-5', title: 'Deployment & QA', description: 'Deploy the application and perform quality assurance testing.', status: 'todo', startDate: '2024-11-01', endDate: '2024-11-30', weight: 10, teamId: 'team-1', teamLeadId: 'user-1' },
    ],
  },
  {
    id: 'proj-2',
    name: 'Mobile App for Task Management',
    description: 'A new mobile application for users to manage their daily tasks and improve productivity.',
    startDate: '2024-09-01',
    endDate: '2024-12-31',
    tasks: [
      { id: 'task-2-1', title: 'Market Research', description: 'Analyze competitor apps and market trends.', status: 'done', startDate: '2024-09-01', endDate: '2024-09-15', weight: 10, teamId: 'team-3', teamLeadId: 'user-5' },
      { id: 'task-2-2', title: 'API Development', description: 'Develop REST APIs for the mobile app.', status: 'in-progress', startDate: '2024-09-16', endDate: '2024-11-15', weight: 35, teamId: 'team-2', teamLeadId: 'user-2' },
      { id: 'task-2-3', title: 'Mobile UI/UX Design', description: 'Design the user interface and experience for iOS and Android.', status: 'in-progress', startDate: '2024-09-16', endDate: '2024-10-15', weight: 25, teamId: 'team-3', teamLeadId: 'user-5' },
      { id: 'task-2-4', title: 'Mobile App Development', description: 'Develop the native mobile application.', status: 'todo', startDate: '2024-10-16', endDate: '2024-12-15', weight: 30, teamId: 'team-1', teamLeadId: 'user-1' },
    ],
  },
];
