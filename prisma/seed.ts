
import { PrismaClient, BlockerStatus, TaskStatus, TaskUpdateType } from '@prisma/client';
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
  
  // Seed Users
  for (const user of usersData) {
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
  console.log(`Seeded ${usersData.length} users.`);

  // Seed Departments
  for (const department of departmentsData) {
      await prisma.department.upsert({
          where: { id: (department as any).id },
          update: {},
          create: {
            id: (department as any).id,
            name: department.name,
            responsibleName: department.responsible.name,
            responsibleTitle: department.responsible.title,
            responsiblePhone: department.responsible.phone,
          }
      });
  }
  console.log(`Seeded ${departmentsData.length} departments.`);

  // Seed Project Statuses
  for (const status of projectStatusesData) {
    await prisma.projectStatus.upsert({
        where: { id: (status as any).id },
        update: {},
        create: {
            id: (status as any).id,
            name: status.name,
        },
    });
  }
  console.log(`Seeded ${projectStatusesData.length} project statuses.`);

  // Seed Projects, Milestones, Tasks, Updates, and Blockers
  for (const project of projectsData) {
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
            status: blocker.status === 'open' ? BlockerStatus.OPEN : BlockerStatus.RESOLVED,
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
      const createdMilestone = await prisma.milestone.upsert({
        where: { id: milestone.id },
        update: {
          responsibleDepartments: {
            set: milestone.responsibleDepartmentIds.map(id => ({ id: id as string }))
          }
        },
        create: {
          id: milestone.id,
          title: milestone.title,
          description: milestone.description,
          startDate: new Date(milestone.startDate),
          dueDate: new Date(milestone.dueDate),
          weight: milestone.weight,
          project: { connect: { id: project.id } },
          responsibleDepartments: {
            connect: milestone.responsibleDepartmentIds.map(id => ({ id: id as string })),
          },
        },
      });

      // Upsert Tasks
      for (const task of milestone.tasks) {
        const statusMap = {
            'todo': TaskStatus.TODO,
            'in-progress': TaskStatus.IN_PROGRESS,
            'pending-review': TaskStatus.PENDING_REVIEW,
            'done': TaskStatus.DONE
        };
        const taskStatus = statusMap[task.status as keyof typeof statusMap] || TaskStatus.TODO;
        
        const createdTask = await prisma.task.upsert({
          where: { id: task.id },
          update: {
            assignees: {
              set: task.assignedUserIds.map(id => ({ id: id as string }))
            }
          },
          create: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: taskStatus,
            startDate: new Date(task.startDate),
            endDate: new Date(task.endDate),
            weight: task.weight,
            completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
            milestone: { connect: { id: createdMilestone.id } },
            assignees: {
              connect: task.assignedUserIds.map(id => ({ id: id as string })),
            },
          },
        });
        
        // Upsert Task Updates
        if (task.updates) {
          for (const update of task.updates) {
            const updateTypeMap = {
                'comment': TaskUpdateType.COMMENT,
                'status-change': TaskUpdateType.STATUS_CHANGE
            };
            const updateType = updateTypeMap[update.type as keyof typeof updateTypeMap] || TaskUpdateType.COMMENT;

            await prisma.taskUpdate.upsert({
                where: { id: update.id },
                update: {},
                create: {
                    id: update.id,
                    text: update.text,
                    type: updateType,
                    createdAt: new Date(update.createdAt),
                    author: { connect: { id: update.authorId } },
                    task: { connect: { id: createdTask.id } }
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
    await prisma.team.upsert({
      where: { id: team.id },
      update: {
        members: {
          set: team.memberIds.map(id => ({ id }))
        }
      },
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
