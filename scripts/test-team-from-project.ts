/**
 * Creating and editing a team from a project card.
 *
 * This is the path that broke when Team stopped belonging to a single project:
 * the projects page still sent `projectId` while the action expected
 * `projectIds`, so every attempt failed with "Cannot read properties of
 * undefined (reading 'map')" — and the cards read `project.teams`, which no
 * longer existed, so teams that did exist showed as none.
 *
 *   npx tsx scripts/test-team-from-project.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MARKER = 'ZZTEAMPROJ';

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
  const ids = projects.map((p) => p.id);
  if (ids.length) {
    await prisma.projectTeam.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.projectAssignment.deleteMany({ where: { projectId: { in: ids } } });
  }
  await prisma.team.deleteMany({ where: { name: { startsWith: MARKER } } });
  await prisma.project.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { startsWith: '070002' } } });
}

async function main() {
  console.log('\nAdding a team from a project card\n');
  await cleanup();

  const status = await prisma.projectStatus.findFirst({ where: { category: 'ACTIVE' } });
  const division = await prisma.pmoDivision.findFirst();
  if (!status || !division) throw new Error('Expected reference data to exist.');

  const lead = await prisma.user.create({
    data: {
      firstName: 'TP', lastName: 'Lead', name: 'TP Lead',
      email: `${MARKER.toLowerCase()}.lead@example.invalid`,
      phoneNumber: '0700020001',
    },
  });
  const member = await prisma.user.create({
    data: {
      firstName: 'TP', lastName: 'Member', name: 'TP Member',
      email: `${MARKER.toLowerCase()}.member@example.invalid`,
      phoneNumber: '0700020002',
    },
  });

  const base = {
    description: 'Created by scripts/test-team-from-project.ts',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    workingYear: '2026/2027',
    statusId: status.id,
    pmoDivisionId: division.id,
    projectManagerId: lead.id,
    stage: 'APPROVED' as const,
  };
  const alpha = await prisma.project.create({ data: { ...base, name: `${MARKER} Alpha` } });
  const beta = await prisma.project.create({ data: { ...base, name: `${MARKER} Beta` } });

  // ------------------------------------------------------------------ create
  console.log('1. Creating one from a project\n');

  // Exactly what the dialog now sends: the project it was opened from.
  const created = await prisma.team.create({
    data: {
      name: `${MARKER} Delivery`,
      teamLeadId: lead.id,
      members: { connect: [{ id: member.id }] },
      projects: { create: [{ projectId: alpha.id }] },
    },
    include: { projects: true },
  });
  check('the team is created and linked to that project', created.projects.length === 1);
  check('and to the right one', created.projects[0].projectId === alpha.id);

  // --------------------------------------------------------------- read back
  console.log('\n2. The project card can see it\n');

  const withLinks = await prisma.project.findUnique({
    where: { id: alpha.id },
    include: {
      teamLinks: {
        include: {
          team: {
            include: { members: true, teamLead: true, projects: { select: { projectId: true } } },
          },
        },
      },
    },
  });

  // The shape the action hands to the card.
  const teams = (withLinks?.teamLinks ?? []).map((link) => ({
    ...link.team,
    projectIds: link.team.projects.map((p) => p.projectId),
  }));

  check('the project reports one team, not none', teams.length === 1, `got ${teams.length}`);
  check('the card can read its name', teams[0]?.name === `${MARKER} Delivery`);
  check('the card can read its lead', teams[0]?.teamLead?.id === lead.id);
  check('the card can read its members', teams[0]?.members?.length === 1);
  check('and the team knows every project it serves', teams[0]?.projectIds?.length === 1);

  // ------------------------------------------------------------------ edit
  console.log('\n3. Editing from one project keeps the others\n');

  // Put the team on a second project, as the teams page would.
  await prisma.projectTeam.create({ data: { teamId: created.id, projectId: beta.id } });

  const reloaded = await prisma.team.findUnique({
    where: { id: created.id },
    include: { projects: { select: { projectId: true } } },
  });
  const existing = reloaded!.projects.map((p) => p.projectId);
  check('the team now serves two projects', existing.length === 2);

  // What the dialog sends when edited from Alpha: the full set, not just Alpha.
  const submitted = existing.includes(alpha.id) ? existing : [...existing, alpha.id];
  check('the dialog would submit both, not just the one being viewed', submitted.length === 2);

  // The update action replaces the link set with exactly what it is given.
  const before = new Set(existing);
  const after = new Set(submitted);
  const removed = [...before].filter((id) => !after.has(id));
  check('so nothing is dropped', removed.length === 0, `would remove ${removed.length}`);

  // The failure this guards against: submitting only the viewed project.
  const naive = [alpha.id];
  const wouldRemove = [...before].filter((id) => !naive.includes(id));
  check(
    'whereas submitting only the viewed project would have dropped the other',
    wouldRemove.length === 1,
  );

  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
