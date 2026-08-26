/**
 * The issue register and the reusable team model, against a real database.
 *
 * The unit tests cover the rules; these cover the things only a database can
 * answer: that the new statuses actually count as blocking, that deleting a
 * project no longer deletes the team, and that the unique keys hold.
 *
 *   npx tsx scripts/test-issues-teams.ts
 */
import { PrismaClient } from '@prisma/client';

import { OPEN_BLOCKER_STATUSES, isOpenBlocker } from '../src/lib/validation/blocker';
import { summarizeAllocation } from '../src/lib/metrics/allocation';

const prisma = new PrismaClient();
const MARKER = 'ZZITTEST';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function cleanup() {
  const projects = await prisma.project.findMany({
    where: { name: { startsWith: MARKER } },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length) {
    await prisma.blocker.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectAssignment.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectTeam.deleteMany({ where: { projectId: { in: projectIds } } });
  }
  await prisma.team.deleteMany({ where: { name: { startsWith: MARKER } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { startsWith: '070001' } } });
}

async function main() {
  console.log('\nIssue register and team model\n');
  await cleanup();

  const status = await prisma.projectStatus.findFirst({ where: { category: 'ACTIVE' } });
  const division = await prisma.pmoDivision.findFirst();
  if (!status || !division) throw new Error('Expected reference data to exist.');

  const [lead, member] = await Promise.all([
    prisma.user.create({
      data: {
        firstName: 'IT', lastName: 'Lead', name: 'IT Lead',
        email: `${MARKER.toLowerCase()}.lead@example.invalid`,
        phoneNumber: '0700010001',
      },
    }),
    prisma.user.create({
      data: {
        firstName: 'IT', lastName: 'Member', name: 'IT Member',
        email: `${MARKER.toLowerCase()}.member@example.invalid`,
        phoneNumber: '0700010002',
      },
    }),
  ]);

  const projectData = (name: string) => ({
    name: `${MARKER} ${name}`,
    description: 'Created by scripts/test-issues-teams.ts',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    workingYear: '2026/2027',
    statusId: status.id,
    pmoDivisionId: division.id,
    projectManagerId: lead.id,
    stage: 'APPROVED' as const,
  });

  const alpha = await prisma.project.create({ data: projectData('Alpha') });
  const beta = await prisma.project.create({ data: projectData('Beta') });

  // ------------------------------------------------------- the issue register
  console.log('1. What still counts as blocking\n');

  const statuses = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'] as const;
  for (const s of statuses) {
    await prisma.blocker.create({
      data: {
        projectId: alpha.id,
        title: `${MARKER} ${s}`,
        description: `An issue in the ${s} state, created by the test.`,
        status: s,
        severity: 'HIGH',
        category: 'VENDOR',
        raisedById: lead.id,
      },
    });
  }

  const blockingCount = await prisma.blocker.count({
    where: { projectId: alpha.id, status: { in: [...OPEN_BLOCKER_STATUSES] } },
  });
  check(
    'open, in progress and escalated all count as blocking',
    blockingCount === 3,
    `counted ${blockingCount}`,
  );

  const naiveCount = await prisma.blocker.count({
    where: { projectId: alpha.id, status: 'OPEN' },
  });
  check(
    'filtering on OPEN alone would have missed two of them',
    naiveCount === 1,
    `counted ${naiveCount}`,
  );

  const all = await prisma.blocker.findMany({ where: { projectId: alpha.id } });
  check(
    'the database and the pure rule agree on every status',
    all.every((b) => isOpenBlocker(b.status) === [...OPEN_BLOCKER_STATUSES].includes(b.status as never)),
  );

  console.log('\n2. Escalation is recorded\n');

  const escalated = await prisma.blocker.findFirst({
    where: { projectId: alpha.id, status: 'ESCALATED' },
  });
  await prisma.blocker.update({
    where: { id: escalated!.id },
    data: {
      escalatedToId: member.id,
      escalatedAt: new Date(),
      escalationReason: 'Two missed vendor dates.',
    },
  });
  const withEscalation = await prisma.blocker.findUnique({
    where: { id: escalated!.id },
    include: { escalatedTo: { select: { name: true } } },
  });
  check('who it was escalated to survives', withEscalation?.escalatedTo?.name === 'IT Member');
  check('and when', withEscalation?.escalatedAt instanceof Date);
  check('and why', (withEscalation?.escalationReason ?? '').length > 0);

  console.log('\n3. Removing a person keeps the issue\n');

  const owned = await prisma.blocker.create({
    data: {
      projectId: alpha.id,
      title: `${MARKER} owned issue`,
      description: 'Owned by somebody who is about to be deleted.',
      severity: 'CRITICAL',
      category: 'RESOURCE',
      ownerId: member.id,
      raisedById: lead.id,
    },
  });

  // ---------------------------------------------------------- the team model
  console.log('\n4. A team serves several projects\n');

  const team = await prisma.team.create({
    data: {
      name: `${MARKER} Delivery`,
      teamLeadId: lead.id,
      members: { connect: [{ id: member.id }] },
      projects: { create: [{ projectId: alpha.id }, { projectId: beta.id }] },
    },
    include: { projects: true },
  });
  check('one team is linked to two projects', team.projects.length === 2);

  let duplicateRefused = false;
  try {
    await prisma.projectTeam.create({ data: { teamId: team.id, projectId: alpha.id } });
  } catch {
    duplicateRefused = true;
  }
  check('the same team cannot be added to a project twice', duplicateRefused);

  console.log('\n5. Deleting a project keeps the team\n');

  await prisma.blocker.deleteMany({ where: { projectId: beta.id } });
  await prisma.project.delete({ where: { id: beta.id } });

  const teamAfter = await prisma.team.findUnique({
    where: { id: team.id },
    include: { projects: true, members: true },
  });
  check('the team still exists after its project is deleted', teamAfter !== null);
  check('it keeps its members', (teamAfter?.members.length ?? 0) === 1);
  check(
    'and only the link to the deleted project is gone',
    teamAfter?.projects.length === 1 && teamAfter.projects[0].projectId === alpha.id,
  );

  console.log('\n6. Assignments and capacity\n');

  await prisma.projectAssignment.createMany({
    data: [
      { userId: member.id, projectId: alpha.id, role: 'MEMBER', allocationPct: 60 },
      { userId: lead.id, projectId: alpha.id, role: 'PROJECT_MANAGER', allocationPct: 50 },
      { userId: lead.id, projectId: alpha.id, role: 'TEAM_LEAD', allocationPct: 50 },
    ],
  });

  let sameRoleRefused = false;
  try {
    await prisma.projectAssignment.create({
      data: { userId: member.id, projectId: alpha.id, role: 'MEMBER', allocationPct: 10 },
    });
  } catch {
    sameRoleRefused = true;
  }
  check('the same person cannot hold the same role twice on a project', sameRoleRefused);

  const leadRoles = await prisma.projectAssignment.count({
    where: { userId: lead.id, projectId: alpha.id },
  });
  check('but can hold two different roles', leadRoles === 2, `found ${leadRoles}`);

  const rows = await prisma.projectAssignment.findMany({
    where: { projectId: alpha.id },
    select: { userId: true, projectId: true, allocationPct: true, startDate: true, endDate: true },
  });
  const summary = summarizeAllocation(rows);
  const leadSummary = summary.find((r) => r.userId === lead.id);
  check(
    'two roles on one project add up for capacity',
    leadSummary?.totalPct === 100,
    `got ${leadSummary?.totalPct}`,
  );
  check('and still count as one project', leadSummary?.projectCount === 1);

  console.log('\n7. Removing a person keeps the record\n');

  await prisma.projectAssignment.deleteMany({ where: { userId: member.id } });
  await prisma.team.update({
    where: { id: team.id },
    data: { members: { disconnect: [{ id: member.id }] } },
  });
  await prisma.user.delete({ where: { id: member.id } });

  const survived = await prisma.blocker.findUnique({ where: { id: owned.id } });
  check('the issue survives its owner being deleted', survived !== null);
  check('and its owner is cleared rather than the row vanishing', survived?.ownerId === null);

  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
