import { PrismaClient, BlockerStatus, TaskStatus, TaskUpdateType } from '@prisma/client';
import { 
    users, 
    departments, 
    projectStatuses, 
    projects, 
    teams 
} from '../src/lib/data';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);
  
  // Seed Users
  for (const user of users) {
      await prisma.user.upsert({
          where: { email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@teamflow.com` },
          update: {},
          create: {
            id: user.id,
            name: user.name,
            email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@teamflow.com`,
            password: 'password123', // In a real app, this should be hashed
            avatar: user.avatar,
            phone: user.phone,
          }
      });
  }
  console.log(`Seeded ${users.length} users.`);

  // Seed Departments
  for (const department of departments) {
      await prisma.department.upsert({
          where: { id: department.id },
          update: {},
          create: {
            id: department.id,
            name: department.name,
            responsibleName: department.responsible.name,
            responsibleTitle: department.responsible.title,
            responsiblePhone: department.responsible.phone,
          }
      });
  }
  console.log(`Seeded ${departments.length} departments.`);

  // Seed Project Statuses
  for (const status of projectStatuses) {
    await prisma.projectStatus.upsert({
        where: { id: status.id },
        update: {},
        create: status,
    });
  }
  console.log(`Seeded ${projectStatuses.length} project statuses.`);

  // Seed Projects, Milestones, Tasks, Updates, and Blockers
  for (const project of projects) {
    // Upsert Project
    await prisma.project.upsert({
      where: { id: project.id },
      update: {},
      create: {
        id: project.id,
        name: project.name,
        description: project.description,
        startDate: new Date(project.startDate),
        endDate: new Date(project.endDate),
        workingYear: project.workingYear,
        status: { connect: { id: project.statusId } },
        owningDepartment: { connect: { id: project.departmentId } },
        projectManager: { connect: { id: project.projectManagerId } },
      },
    });

    // Upsert Blockers
    if (project.blockers) {
      for (const blocker of project.blockers) {
        await prisma.blocker.upsert({
          where: { id: blocker.id },
          update: {},
          create: {
            id: blocker.id,
            description: blocker.description,
            status: blocker.status.toUpperCase() as BlockerStatus,
            createdAt: new Date(blocker.createdAt),
            resolvedAt: blocker.resolvedAt ? new Date(blocker.resolvedAt) : undefined,
            resolution: blocker.resolution,
            project: { connect: { id: project.id } },
          },
        });
      }
    }

    // Upsert Milestones
    for (const milestone of project.milestones) {
      await prisma.milestone.upsert({
        where: { id: milestone.id },
        update: {},
        create: {
          id: milestone.id,
          title: milestone.title,
          description: milestone.description,
          dueDate: new Date(milestone.dueDate),
          weight: milestone.weight,
          project: { connect: { id: project.id } },
          responsibleDepartments: {
            connect: milestone.responsibleDepartmentIds.map(id => ({ id })),
          },
        },
      });

      // Upsert Tasks
      for (const task of milestone.tasks) {
        await prisma.task.upsert({
          where: { id: task.id },
          update: {},
          create: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status.replace('-', '_').toUpperCase() as TaskStatus,
            startDate: new Date(task.startDate),
            endDate: new Date(task.endDate),
            weight: task.weight,
            completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
            milestone: { connect: { id: milestone.id } },
            assignees: {
              connect: task.assignedUserIds.map(id => ({ id })),
            },
          },
        });
        
        // Upsert Task Updates
        if (task.updates) {
          for (const update of task.updates) {
            await prisma.taskUpdate.upsert({
                where: { id: update.id },
                update: {},
                create: {
                    id: update.id,
                    text: update.text,
                    type: (update.type ?? 'comment').replace('-', '_').toUpperCase() as TaskUpdateType,
                    createdAt: new Date(update.createdAt),
                    author: { connect: { id: update.userId } },
                    task: { connect: { id: task.id } }
                }
            })
          }
        }
      }
    }
  }
  console.log(`Seeded ${projects.length} projects and their nested data.`);

  // Seed Teams
  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: {},
      create: {
        id: team.id,
        name: team.name,
        project: { connect: { id: team.projectId } },
        teamLead: { connect: { id: team.teamLeadId } },
        members: {
          connect: team.memberIds.map(id => ({ id }))
        }
      }
    });
  }
  console.log(`Seeded ${teams.length} teams.`);
  
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
