
import { PrismaClient } from '@prisma/client';
import { 
    users as usersData, 
    departments as departmentsData, 
    projectStatuses as projectStatusesData, 
    projects as projectsData, 
    teams as teamsData 
} from '../src/lib/data';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // Seed Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin', description: 'Full access to all system features.', permissions: ['manage_users', 'manage_roles', 'manage_projects'] },
  });
  const memberRole = await prisma.role.upsert({
    where: { name: 'Member' },
    update: {},
    create: { name: 'Member', description: 'Can view projects and manage assigned tasks.', permissions: ['view_projects', 'manage_own_tasks'] },
  });
  console.log('Seeded roles.');

  // Seed Users and create a map
  const userMap = new Map<string, string>();
  for (const user of usersData) {
      const createdUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {},
          create: {
            id: user.id,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar,
            phoneNumber: user.phoneNumber,
            roles: {
              connect: { id: user.email === 'alice.johnson@teamflow.com' ? adminRole.id : memberRole.id }
            }
          }
      });
      userMap.set(createdUser.email, createdUser.id);
  }
  console.log(`Seeded ${usersData.length} users.`);

  // Seed Departments and create a map
  const departmentMap = new Map<string, string>();
  for (const department of departmentsData) {
      const createdDept = await prisma.department.upsert({
          where: { name: department.name },
          update: {},
          create: {
            name: department.name,
            responsibleName: department.responsible.name,
            responsibleTitle: department.responsible.title,
            responsiblePhone: department.responsible.phone,
          }
      });
      departmentMap.set(createdDept.name, createdDept.id);
  }
  console.log(`Seeded ${departmentsData.length} departments.`);

  // Seed Project Statuses and create a map
  const statusMap = new Map<string, string>();
  for (const status of projectStatusesData) {
    const createdStatus = await prisma.projectStatus.upsert({
        where: { name: status.name },
        update: {},
        create: { name: status.name },
    });
    statusMap.set(createdStatus.name, createdStatus.id);
  }
  console.log(`Seeded ${projectStatusesData.length} project statuses.`);

  // Seed Projects, Milestones, Tasks, Updates, and Blockers
  for (const project of projectsData) {
    const projectManagerId = userMap.get(project.projectManagerEmail);
    const statusId = statusMap.get(project.statusName);
    const departmentId = departmentMap.get(project.departmentName);

    if (!projectManagerId || !statusId || !departmentId) {
        console.warn(`Skipping project "${project.name}" due to missing relations.`);
        continue;
    }

    const createdProject = await prisma.project.upsert({
      where: { id: project.id },
      update: {},
      create: {
        id: project.id,
        name: project.name,
        description: project.description,
        startDate: new Date(project.startDate),
        endDate: new Date(project.endDate),
        workingYear: project.workingYear,
        statusId: statusId,
        departmentId: departmentId,
        projectManagerId: projectManagerId,
      },
    });

    if (project.blockers) {
      for (const blocker of project.blockers) {
        await prisma.blocker.upsert({
          where: { id: blocker.id },
          update: {},
          create: {
            id: blocker.id,
            description: blocker.description,
            status: blocker.status,
            createdAt: new Date(blocker.createdAt),
            resolvedAt: blocker.resolvedAt ? new Date(blocker.resolvedAt) : undefined,
            resolution: blocker.resolution,
            projectId: createdProject.id,
          },
        });
      }
    }

    for (const milestone of project.milestones) {
      const responsibleDepartmentIds = milestone.responsibleDepartmentNames
        .map(name => departmentMap.get(name))
        .filter((id): id is string => !!id);

      const createdMilestone = await prisma.milestone.upsert({
        where: { id: milestone.id },
        update: {
          responsibleDepartments: {
            set: responsibleDepartmentIds.map(id => ({ id }))
          }
        },
        create: {
          id: milestone.id,
          title: milestone.title,
          description: milestone.description,
          startDate: new Date(milestone.startDate),
          dueDate: new Date(milestone.dueDate),
          weight: milestone.weight,
          projectId: createdProject.id,
          responsibleDepartments: {
            connect: responsibleDepartmentIds.map(id => ({ id })),
          },
        },
      });

      for (const task of milestone.tasks) {
        const assigneeIds = task.assignedUserEmails
            .map(email => userMap.get(email))
            .filter((id): id is string => !!id);
        
        const createdTask = await prisma.task.upsert({
          where: { id: task.id },
          update: {
            assignees: { set: assigneeIds.map(id => ({ id })) }
          },
          create: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            startDate: new Date(task.startDate),
            endDate: new Date(task.endDate),
            weight: task.weight,
            completedAt: task.status === 'DONE' && !task.completedAt ? new Date() : (task.completedAt ? new Date(task.completedAt) : undefined),
            milestoneId: createdMilestone.id,
            assignees: {
              connect: assigneeIds.map(id => ({ id })),
            },
          },
        });
        
        if (task.updates) {
          for (const update of task.updates) {
            const authorId = userMap.get(update.userEmail);
            if (!authorId) continue;
            
            await prisma.taskUpdate.upsert({
                where: { id: update.id },
                update: {},
                create: {
                    id: update.id,
                    text: update.text,
                    type: update.type,
                    createdAt: new Date(update.createdAt),
                    authorId: authorId,
                    taskId: createdTask.id
                }
            })
          }
        }
      }
    }
  }
  console.log(`Seeded ${projectsData.length} projects and their nested data.`);

  // Seed Teams
  for (const team of teamsData) {
    const teamLeadId = userMap.get(team.teamLeadEmail);
    const memberIds = team.memberEmails
        .map(email => userMap.get(email))
        .filter((id): id is string => !!id);

    if (!teamLeadId) continue;

    await prisma.team.upsert({
      where: { id: team.id },
      update: {
        members: { set: memberIds.map(id => ({ id })) }
      },
      create: {
        id: team.id,
        name: team.name,
        projectId: team.projectId,
        teamLeadId: teamLeadId,
        members: {
          connect: memberIds.map(id => ({ id }))
        }
      }
    });
  }
  console.log(`Seeded ${teamsData.length} teams.`);
  
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
