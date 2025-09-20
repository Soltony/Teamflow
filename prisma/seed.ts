
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Clearing existing data...`);
  // Deleting in order to respect foreign key constraints
  await prisma.taskUpdate.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.team.deleteMany();
  await prisma.blocker.deleteMany();
  await prisma.timelineChangeRequest.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.department.deleteMany();
  await prisma.pmoDivision.deleteMany();
  await prisma.projectStatus.deleteMany();
  await prisma.setting.deleteMany();
  console.log('Existing data cleared.');

  console.log(`Start seeding ...`);

  // Seed ProjectStatus
  const statuses = [
    { id: 'clwxs0y7c000208l3fc8f5x2g', name: 'Active' },
    { id: 'clwxs0y7d000308l3b1n0a9k6', name: 'Pending' },
    { id: 'clwxs0y7d000408l3h8d3g7k5', name: 'Parked' },
    { id: 'clwxs0y7d000508l3e2f4a9b8', name: 'Completed' },
    { id: 'clwxs0y7d000608l3c3h6g7k9', name: 'On Handover' },
  ];
  for (const status of statuses) {
    await prisma.projectStatus.create({ data: status });
  }
  console.log(`Seeded ${statuses.length} project statuses.`);

  // Seed PmoDivision
  const pmoDivisions = [
    { id: 'clwxs0y7e000708l3a4b5c6d7', name: 'Technical Programs', responsibleName: 'Biruk Zegeju', responsibleTitle: 'Director', responsiblePhone: '0913212762' },
    { id: 'clwxs0y7e000808l3d8e9f0g1', name: 'Business Programs', responsibleName: 'Nigatu Wolde', responsibleTitle: 'Director Business Programs', responsiblePhone: '0911467473' },
  ];
  for (const pmo of pmoDivisions) {
    await prisma.pmoDivision.create({ data: pmo });
  }
  console.log(`Seeded ${pmoDivisions.length} PMO divisions.`);
  
  // Seed Department
  const departments = [
    { id: 'clwxs0y7f000908l3b1c2d3e4', name: 'Digital Banking Office' },
    { id: 'clwxs0y7f000a08l3f5g6h7i8', name: 'IS-Infrastructure' },
    { id: 'clwxs0y7g000b08l3j9k0l1m2', name: 'Finance' },
    { id: 'clwxs0y7g000c08l3n3o4p5q6', name: 'Human Capital' },
  ];
  for (const dept of departments) {
    await prisma.department.create({ data: dept });
  }
  console.log(`Seeded ${departments.length} departments.`);
  
  // Seed Roles
  const roles = [
    { id: 'clwxs0y7h000d08l3a1b2c3d4', name: 'Admin', description: 'Full access to all system features.', permissions: ['dashboard:view','my-tasks:view','team-view:view','team-view:manage','projects:create','projects:read','projects:update','projects:delete','milestones:view','gantt:view','pmo-divisions:view','pmo-divisions:create','pmo-divisions:update','pmo-divisions:delete','departments:read','departments:create','departments:update','departments:delete','teams:create','teams:read','teams:update','teams:delete','payments:view','payment-approvals:view','payment-approvals:manage','reports:view','settings:manage','config:manage-users','config:manage-roles'] },
    { id: 'clwxs0y7h000e08l3e5f6g7h8', name: 'Project Manager', description: 'Can create and manage assigned projects, teams, and tasks.', permissions: ['dashboard:view','my-tasks:view','team-view:view','team-view:manage','projects:create','projects:read','projects:update','milestones:view','gantt:view','reports:view', 'timeline:request'] },
    { id: 'clwxs0y7i000f08l3i9j0k1l2', name: 'Member', description: 'Can view assigned tasks and update their status.', permissions: ['dashboard:view','my-tasks:view','projects:read','milestones:view','gantt:view'] },
    { id: 'clwxs0y7i000g08l3m3n4o5p6', name: 'Team Lead', description: 'Can manage tasks for their team.', permissions: ['dashboard:view','my-tasks:view','team-view:view','team-view:manage','projects:read','milestones:view','gantt:view'] },
    { id: 'clwxs0y7j000h08l3q7r8s9t0', name: 'CEO', description: 'Has high-level read-only access to portfolio reports.', permissions: ['dashboard:view','reports:view','projects:read','gantt:view'] },
  ];
  for (const role of roles) {
    await prisma.role.create({ data: role });
  }
  console.log(`Seeded ${roles.length} roles.`);

  // Seed Users
  const users = [
    { id: 'b1e55c84-9055-4eb5-8bd4-a262538f7e66', name: 'Admin User', firstName: 'Admin', lastName: 'User', email: 'admin@nibepmo.com', phoneNumber: '0900000000', pmoDivisionId: pmoDivisions[0].id, roleIds: [roles[0].id] },
    { id: 'user-pm-1', name: 'Alice Johnson', firstName: 'Alice', lastName: 'Johnson', email: 'alice@nibepmo.com', phoneNumber: '0911111111', pmoDivisionId: pmoDivisions[0].id, roleIds: [roles[1].id] },
    { id: 'user-member-1', name: 'Bob Williams', firstName: 'Bob', lastName: 'Williams', email: 'bob@nibepmo.com', phoneNumber: '0922222222', pmoDivisionId: pmoDivisions[0].id, roleIds: [roles[2].id] },
    { id: 'user-lead-1', name: 'Charlie Brown', firstName: 'Charlie', lastName: 'Brown', email: 'charlie@nibepmo.com', phoneNumber: '0933333333', pmoDivisionId: pmoDivisions[0].id, roleIds: [roles[3].id] },
    { id: 'user-ceo-1', name: 'Diana Miller', firstName: 'Diana', lastName: 'Miller', email: 'diana@nibepmo.com', phoneNumber: '0944444444', roleIds: [roles[4].id] },
  ];

  for (const userData of users) {
    await prisma.user.create({
      data: {
        id: userData.id,
        name: userData.name,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        avatar: `https://i.pravatar.cc/150?u=${userData.id}`,
        pmoDivisionId: userData.pmoDivisionId,
        roles: {
          connect: userData.roleIds.map(id => ({ id }))
        }
      }
    });
  }
  console.log(`Seeded ${users.length} users.`);

  // Seed Projects
  const projects = [
    {
      id: 'proj-1',
      name: 'Automate EPMO',
      description: 'Design and develop a software solution to automate key tasks within the Enterprise Program Management Office.',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-12-31'),
      workingYear: '2024/2025',
      statusId: statuses[0].id, // Active
      pmoDivisionId: pmoDivisions[0].id,
      projectManagerId: users[1].id, // Alice Johnson
      totalCost: new Prisma.Decimal(120000.00),
      currency: 'ETB',
      responsibleDepartmentIds: [departments[0].id, departments[1].id],
    },
    {
      id: 'proj-2',
      name: 'Capital Market Entry',
      description: 'Listing of NIB in the Capital Market (ESX) to enable it to sell shares and raise capital.',
      startDate: new Date('2024-08-15'),
      endDate: new Date('2025-03-15'),
      workingYear: '2024/2025',
      statusId: statuses[1].id, // Pending
      pmoDivisionId: pmoDivisions[1].id,
      projectManagerId: users[1].id,
      totalCost: null,
      currency: 'ETB',
      responsibleDepartmentIds: [departments[2].id],
    },
  ];

  for (const proj of projects) {
    const { responsibleDepartmentIds, ...projectData } = proj;
    await prisma.project.create({
      data: {
        ...projectData,
        responsibleDepartments: {
          connect: responsibleDepartmentIds.map(id => ({ id })),
        }
      }
    });
  }
  console.log(`Seeded ${projects.length} projects.`);

  // Seed Milestones
  const milestones = [
    {
      id: 'mile-1-1',
      title: 'Phase 1: Planning & Design',
      description: 'Finalize requirements, system architecture, and UI/UX design.',
      startDate: new Date('2024-07-01'),
      dueDate: new Date('2024-08-31'),
      weight: 30,
      projectId: projects[0].id,
    },
    {
      id: 'mile-1-2',
      title: 'Phase 2: Development & Testing',
      description: 'Complete frontend and backend development and conduct internal QA.',
      startDate: new Date('2024-09-01'),
      dueDate: new Date('2024-11-30'),
      weight: 60,
      projectId: projects[0].id,
    },
    {
      id: 'mile-1-3',
      title: 'Phase 3: Deployment & Handover',
      description: 'Deploy to production and handover to the operations team.',
      startDate: new Date('2024-12-01'),
      dueDate: new Date('2024-12-31'),
      weight: 10,
      projectId: projects[0].id,
    }
  ];

  for (const milestone of milestones) {
    await prisma.milestone.create({ data: milestone });
  }
  console.log(`Seeded ${milestones.length} milestones.`);

  // Seed Tasks
  const tasks = [
    {
      id: 'task-1-1-1',
      title: 'Backend API Development',
      description: 'Develop all necessary API endpoints for the EPMO system.',
      status: 'IN_PROGRESS' as const,
      startDate: new Date('2024-09-01'),
      endDate: new Date('2024-10-15'),
      weight: 50,
      progress: 40,
      milestoneId: milestones[1].id,
      assigneeIds: [users[2].id], // Bob Williams
    },
    {
      id: 'task-1-1-2',
      title: 'Frontend UI Implementation',
      description: 'Implement all UI components and pages based on the design.',
      status: 'TODO' as const,
      startDate: new Date('2024-09-15'),
      endDate: new Date('2024-11-15'),
      weight: 50,
      progress: 0,
      milestoneId: milestones[1].id,
      assigneeIds: [users[3].id], // Charlie Brown
    }
  ];

  for (const task of tasks) {
    const { assigneeIds, ...taskData } = task;
    await prisma.task.create({
      data: {
        ...taskData,
        assignees: {
          connect: assigneeIds.map(id => ({ id }))
        }
      }
    });
  }
  console.log(`Seeded ${tasks.length} tasks.`);
  
  // Seed Settings
  await prisma.setting.create({
    data: {
      key: 'activeWorkingYear',
      value: '2024/2025'
    }
  });
  console.log('Seeded 1 setting.');

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
