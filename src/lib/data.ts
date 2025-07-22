
export const roles = [
    { 
        name: 'Admin', 
        description: 'Has access to all system features, including user management.', 
        permissions: ['manage:users', 'manage:roles', 'manage:settings', 'manage:projects'] 
    },
    { 
        name: 'Project Manager', 
        description: 'Can create and manage projects, milestones, and tasks.', 
        permissions: ['create:project', 'edit:project', 'delete:project'] 
    },
    { 
        name: 'Member', 
        description: 'Can view assigned tasks and update their status.', 
        permissions: ['view:task', 'update:task'] 
    },
];

export const users = [
  { id: 'b1e55c84-9055-4eb5-8bd4-a262538f7e66', name: 'Alice Johnson', firstName: 'Alice', lastName: 'Johnson', email: 'alice.johnson@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-1', phoneNumber: '09123456780' },
  { id: 'user-2', name: 'Bob Williams', firstName: 'Bob', lastName: 'Williams', email: 'bob.williams@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-2', phoneNumber: '09123456781' },
  { id: 'user-3', name: 'Charlie Brown', firstName: 'Charlie', lastName: 'Brown', email: 'charlie.brown@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-3', phoneNumber: '09123456782' },
  { id: 'user-4', name: 'Diana Miller', firstName: 'Diana', lastName: 'Miller', email: 'diana.miller@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-4', phoneNumber: '09123456783' },
  { id: 'user-5', name: 'Ethan Davis', firstName: 'Ethan', lastName: 'Davis', email: 'ethan.davis@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-5', phoneNumber: '09123456784' },
  { id: 'user-6', name: 'Fiona Garcia', firstName: 'Fiona', lastName: 'Garcia', email: 'fiona.garcia@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-6', phoneNumber: '09123456785' },
  { id: 'user-7', name: 'George Harris', firstName: 'George', lastName: 'Harris', email: 'george.harris@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-7', phoneNumber: '09123456786' },
  { id: 'user-8', name: 'Helen Clark', firstName: 'Helen', lastName: 'Clark', email: 'helen.clark@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-8', phoneNumber: '09123456787' },
  { id: 'user-9', name: 'Ian King', firstName: 'Ian', lastName: 'King', email: 'ian.king@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-9', phoneNumber: '09123456788' },
  { id: 'user-10', name: 'Jane Wright', firstName: 'Jane', lastName: 'Wright', email: 'jane.wright@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-10', phoneNumber: '09123456789' },
  { id: 'user-11', name: 'Kevin Scott', firstName: 'Kevin', lastName: 'Scott', email: 'kevin.scott@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-11', phoneNumber: '09123456790' },
  { id: 'user-12', name: 'Laura Green', firstName: 'Laura', lastName: 'Green', email: 'laura.green@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-12', phoneNumber: '09123456791' },
  { id: 'user-13', name: 'Mason Adams', firstName: 'Mason', lastName: 'Adams', email: 'mason.adams@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-13', phoneNumber: '09123456792' },
  { id: 'user-14', name: 'Nancy Baker', firstName: 'Nancy', lastName: 'Baker', email: 'nancy.baker@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-14', phoneNumber: '09123456793' },
  { id: 'user-15', name: 'Oscar Campbell', firstName: 'Oscar', lastName: 'Campbell', email: 'oscar.campbell@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-15', phoneNumber: '09123456794' },
  { id: 'user-16', name: 'Penny Carter', firstName: 'Penny', lastName: 'Carter', email: 'penny.carter@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-16', phoneNumber: '09123456795' },
  { id: 'user-17', name: 'Quentin Evans', firstName: 'Quentin', lastName: 'Evans', email: 'quentin.evans@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-17', phoneNumber: '09123456796' },
  { id: 'user-18', name: 'Rachel Foster', firstName: 'Rachel', lastName: 'Foster', email: 'rachel.foster@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-18', phoneNumber: '09123456797' },
  { id: 'user-19', name: 'Steven Gray', firstName: 'Steven', lastName: 'Gray', email: 'steven.gray@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-19', phoneNumber: '09123456798' },
  { id: 'user-20', name: 'Tina Hill', firstName: 'Tina', lastName: 'Hill', email: 'tina.hill@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-20', phoneNumber: '09123456799' },
  { id: 'user-21', name: 'Ulysses Jenkins', firstName: 'Ulysses', lastName: 'Jenkins', email: 'ulysses.jenkins@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-21', phoneNumber: '09123456800' },
  { id: 'user-22', name: 'Victoria Kelly', firstName: 'Victoria', lastName: 'Kelly', email: 'victoria.kelly@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-22', phoneNumber: '09123456801' },
  { id: 'user-23', name: 'Walter Long', firstName: 'Walter', lastName: 'Long', email: 'walter.long@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-23', phoneNumber: '09123456802' },
  { id: 'user-24', name: 'Xena Morris', firstName: 'Xena', lastName: 'Morris', email: 'xena.morris@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-24', phoneNumber: '09123456803' },
  { id: 'user-25', name: 'Yasmine Nelson', firstName: 'Yasmine', lastName: 'Nelson', email: 'yasmine.nelson@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-25', phoneNumber: '09123456804' },
  { id: 'user-26', name: 'Zane Owens', firstName: 'Zane', lastName: 'Owens', email: 'zane.owens@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-26', phoneNumber: '09123456805' },
  { id: 'user-27', name: 'Aaron Peterson', firstName: 'Aaron', lastName: 'Peterson', email: 'aaron.peterson@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-27', phoneNumber: '09123456806' },
  { id: 'user-28', name: 'Brenda Quinn', firstName: 'Brenda', lastName: 'Quinn', email: 'brenda.quinn@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-28', phoneNumber: '09123456807' },
  { id: 'user-29', name: 'Carl Roberts', firstName: 'Carl', lastName: 'Roberts', email: 'carl.roberts@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-29', phoneNumber: '09123456808' },
  { id: 'user-30', name: 'Debra Stewart', firstName: 'Debra', lastName: 'Stewart', email: 'debra.stewart@teamflow.com', avatar: 'https://i.pravatar.cc/150?u=user-30', phoneNumber: '09123456809' },
];

export const pmoDivisionsData = [
    { name: 'Technology', responsibleName: 'Dr. Evelyn Reed', responsibleTitle: 'CTO', responsiblePhone: '09112223333' },
    { name: 'Marketing', responsibleName: 'Marcus Holloway', responsibleTitle: 'CMO', responsiblePhone: '09445556666' },
];

export const departmentsData = [
    { name: 'Finance' },
    { name: 'Human Resources' },
    { name: 'Sales' },
    { name: 'Customer Support' },
];

export const projectStatusesData = [
  { name: 'Active' },
  { name: 'Pending' },
  { name: 'Parked' },
  { name: 'Completed' },
];

export const projectsData = [
  {
    id: 'proj-1',
    name: 'E-commerce Platform Relaunch',
    description: 'Complete overhaul of the existing e-commerce platform to improve user experience and performance.',
    startDate: '2024-08-01',
    endDate: '2024-11-30',
    workingYear: '2024/2025',
    statusName: 'Active',
    pmoDivisionName: 'Technology',
    projectManagerEmail: 'alice.johnson@teamflow.com',
    responsibleDepartmentNames: ['Sales', 'Customer Support'],
    milestones: [
        {
            id: 'mile-1-1',
            title: 'Phase 1: Research & Design',
            description: 'Finalize user research, and create all wireframes and mockups.',
            startDate: '2024-08-01',
            dueDate: '2024-09-10',
            weight: 30,
            tasks: [
                { id: 'task-1-1', title: 'User Research & Analysis', description: 'Conduct user surveys and interviews to gather requirements.', status: 'DONE', startDate: '2024-08-01', endDate: '2024-08-15', weight: 40, assignedUserEmails: ['ethan.davis@teamflow.com'], completedAt: '2024-08-14' },
                { id: 'task-1-2', title: 'Design Wireframes & Mockups', description: 'Create high-fidelity mockups for the new platform.', status: 'IN_PROGRESS', startDate: '2024-08-16', endDate: '2024-09-10', weight: 60, assignedUserEmails: ['ethan.davis@teamflow.com', 'fiona.garcia@teamflow.com'] },
            ]
        },
        {
            id: 'mile-1-2',
            title: 'Phase 2: Development',
            description: 'Complete frontend and backend development.',
            startDate: '2024-09-11',
            dueDate: '2024-10-31',
            weight: 60,
            tasks: [
                { id: 'task-1-3', title: 'Frontend Development', description: 'Develop the client-side of the application using Next.js.', status: 'PENDING_REVIEW', startDate: '2024-09-11', endDate: '2024-10-31', weight: 70, assignedUserEmails: ['alice.johnson@teamflow.com', 'charlie.brown@teamflow.com'],
                  updates: [
                    { id: 'update-1', text: 'Initial component structure is complete. Starting on data binding.', userEmail: 'alice.johnson@teamflow.com', createdAt: '2024-10-15T10:00:00Z', type: 'COMMENT' },
                    { id: 'update-2', text: 'Data binding is done. Ready for review.', userEmail: 'alice.johnson@teamflow.com', createdAt: '2024-10-20T14:30:00Z', type: 'COMMENT' },
                  ]
                },
                { id: 'task-1-4', title: 'Backend Development', description: 'Build the server-side logic and database schema.', status: 'TODO', startDate: '2024-09-11', endDate: '2024-10-31', weight: 30, assignedUserEmails: ['bob.williams@teamflow.com', 'diana.miller@teamflow.com'] },
            ]
        },
        {
            id: 'mile-1-3',
            title: 'Phase 3: Deployment',
            description: 'Deploy the application and conduct QA.',
            startDate: '2024-11-01',
            dueDate: '2024-11-30',
            weight: 10,
            tasks: [
                { id: 'task-1-5', title: 'Deployment & QA', description: 'Deploy the application and perform quality assurance testing.', status: 'TODO', startDate: '2024-11-01', endDate: '2024-11-30', weight: 100, assignedUserEmails: ['alice.johnson@teamflow.com', 'bob.williams@teamflow.com', 'charlie.brown@teamflow.com'] },
            ]
        }
    ],
    blockers: [
        {
            id: 'blocker-1',
            description: 'The third-party payment gateway API is not providing the expected responses for international transactions.',
            status: 'OPEN',
            createdAt: '2024-10-25',
        },
        {
            id: 'blocker-2',
            description: 'Design team has not finalized the new logo, which is blocking the creation of marketing materials.',
            status: 'RESOLVED',
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
    pmoDivisionName: 'Technology',
    projectManagerEmail: 'bob.williams@teamflow.com',
    responsibleDepartmentNames: ['Finance', 'Human Resources'],
    milestones: [
        {
            id: 'mile-2-1',
            title: 'Initial Research and API',
            description: 'Market research and core API development.',
            startDate: '2024-09-01',
            dueDate: '2024-11-15',
            weight: 50,
            tasks: [
                { id: 'task-2-1', title: 'Market Research', description: 'Analyze competitor apps and market trends.', status: 'DONE', startDate: '2024-09-01', endDate: '2024-09-15', weight: 30, assignedUserEmails: ['diana.miller@teamflow.com'] },
                { id: 'task-2-2', title: 'API Development', description: 'Develop REST APIs for the mobile app.', status: 'IN_PROGRESS', startDate: '2024-09-16', endDate: '2024-11-15', weight: 70, assignedUserEmails: ['bob.williams@teamflow.com'] },
            ]
        },
        {
            id: 'mile-2-2',
            title: 'Mobile App Design and Development',
            description: 'UI/UX design and native app development.',
            startDate: '2024-11-16',
            dueDate: '2024-12-15',
            weight: 50,
            tasks: [
                { id: 'task-2-3', title: 'Mobile UI/UX Design', description: 'Design the user interface and experience for iOS and Android.', status: 'IN_PROGRESS', startDate: '2024-09-16', endDate: '2024-10-15', weight: 40, assignedUserEmails: ['ethan.davis@teamflow.com', 'fiona.garcia@teamflow.com'] },
                { id: 'task-2-4', title: 'Mobile App Development', description: 'Develop the native mobile application.', status: 'TODO', startDate: '2024-10-16', endDate: '2024-12-15', weight: 60, assignedUserEmails: ['alice.johnson@teamflow.com', 'charlie.brown@teamflow.com'] },
            ]
        }
    ]
  },
];

export const teamsData = [
  { 
    id: 'team-1', 
    name: 'Frontend Wizards', 
    projectId: 'proj-1', 
    teamLeadEmail: 'alice.johnson@teamflow.com', 
    memberEmails: ['alice.johnson@teamflow.com', 'charlie.brown@teamflow.com'] 
  },
  { 
    id: 'team-2', 
    name: 'Backend Titans', 
    projectId: 'proj-1', 
    teamLeadEmail: 'bob.williams@teamflow.com', 
    memberEmails: ['bob.williams@teamflow.com', 'diana.miller@teamflow.com'] 
  },
  { 
    id: 'team-3', 
    name: 'Marketing Squad', 
    projectId: 'proj-2', 
    teamLeadEmail: 'diana.miller@teamflow.com', 
    memberEmails: ['diana.miller@teamflow.com', 'fiona.garcia@teamflow.com'] 
  },
];

    

    