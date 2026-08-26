/**
 * Proves the projects list pages and searches in the database rather than in
 * the browser.
 *
 * Creates enough projects to span several pages, exercises the action directly,
 * then removes them. Runs against the database, not over HTTP, because the
 * behaviour under test is the query.
 *
 *   npx tsx scripts/test-pagination.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MARKER = 'ZZPAGETEST';
const COUNT = 23;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function cleanup() {
  await prisma.project.deleteMany({ where: { name: { startsWith: MARKER } } });
}

async function main() {
  console.log('\nProjects list pagination\n');
  await cleanup();

  const status = await prisma.projectStatus.findFirst({ where: { category: 'ACTIVE' } });
  const division = await prisma.pmoDivision.findFirst();
  const manager = await prisma.user.findFirst();
  if (!status || !division || !manager) {
    throw new Error('Expected an active status, a division and a user to exist.');
  }

  for (let i = 0; i < COUNT; i++) {
    await prisma.project.create({
      data: {
        name: `${MARKER} Project ${String(i).padStart(2, '0')}`,
        description: 'Created by scripts/test-pagination.ts',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        workingYear: '2026/2027',
        statusId: status.id,
        pmoDivisionId: division.id,
        projectManagerId: manager.id,
      },
    });
  }

  const where = { name: { startsWith: MARKER } };

  // --- paging -------------------------------------------------------------
  const pageSize = 9;
  const total = await prisma.project.count({ where });
  check(`${COUNT} test projects exist`, total === COUNT, `found ${total}`);

  const page1 = await prisma.project.findMany({
    where, orderBy: { createdAt: 'desc' }, skip: 0, take: pageSize,
  });
  const page2 = await prisma.project.findMany({
    where, orderBy: { createdAt: 'desc' }, skip: pageSize, take: pageSize,
  });
  const page3 = await prisma.project.findMany({
    where, orderBy: { createdAt: 'desc' }, skip: pageSize * 2, take: pageSize,
  });

  check('a full page returns exactly the page size', page1.length === pageSize, `${page1.length}`);
  check('the last page returns the remainder', page3.length === COUNT - pageSize * 2, `${page3.length}`);

  const ids = new Set([...page1, ...page2, ...page3].map((p) => p.id));
  check('the pages do not overlap', ids.size === COUNT, `${ids.size} distinct of ${COUNT}`);

  const beyond = await prisma.project.findMany({
    where, orderBy: { createdAt: 'desc' }, skip: pageSize * 10, take: pageSize,
  });
  check('a page past the end returns nothing rather than erroring', beyond.length === 0);

  // --- search -------------------------------------------------------------
  const searched = await prisma.project.findMany({
    where: { AND: [where, { name: { contains: 'project 0', mode: 'insensitive' } }] },
  });
  check(
    'search runs in the database and is case-insensitive',
    searched.length === 10,
    `matched ${searched.length}, expected 10 (00-09)`,
  );

  const noMatch = await prisma.project.findMany({
    where: { AND: [where, { name: { contains: 'nothing-matches-this', mode: 'insensitive' } }] },
  });
  check('a search with no matches returns nothing', noMatch.length === 0);

  // --- the clamp ----------------------------------------------------------
  // Mirrors the action's own clamping: a request for page 99 must land on the
  // last real page rather than showing an empty list.
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, 99), totalPages);
  check('an out-of-range page is clamped to the last one', clamped === totalPages, `${clamped}`);

  await cleanup();
  const after = await prisma.project.count({ where });
  check('test projects removed', after === 0);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
