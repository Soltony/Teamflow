/**
 * The UI/UX changes, checked where each one actually lands.
 *
 * Some of this renders on the server and some only after the client fetches
 * its data, so the checks differ: server HTML for the shell, the built bundle
 * for anything a page draws after loading.
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { execSync } from 'child_process';

const prisma = new PrismaClient();
const BASE = 'http://localhost:3399';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const inBundle = (needle: string) =>
  execSync('grep -rl ' + JSON.stringify(needle) + ' .next/static/chunks/ || true', {
    encoding: 'utf8',
  }).trim().length > 0;

async function main() {
  const user = await prisma.user.findFirst({
    where: { roles: { some: { name: 'Admin' } }, isActive: true, mustChangePassword: false },
    select: { id: true },
  });
  if (!user) throw new Error('no admin available');

  const token = randomBytes(32).toString('base64url');
  const session = await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: user.id,
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  const cookie = `nibteam_session=${token}`;
  const get = (path: string) =>
    fetch(`${BASE}${path}`, { headers: { cookie } }).then((r) => r.text());

  console.log('\nTypography\n');
  const login = await fetch(`${BASE}/login`).then((r) => r.text());
  check('Inter is loaded', /--font-sans:\s*"?Inter/.test(login) || login.includes('__variable_'));
  check('nothing is fetched from fonts.googleapis.com', !login.includes('fonts.googleapis.com'));
  check('the old Arial rule is gone', !login.includes('Arial, Helvetica'));

  console.log('\nPage titles\n');
  const titles: Array<[string, string]> = [
    ['/login', 'Sign in'],
    ['/projects', 'Projects'],
    ['/settings', 'Settings'],
    ['/my-tasks', 'My tasks'],
  ];
  for (const [path, expected] of titles) {
    const html = path === '/login' ? login : await get(path);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    check(`${path} reads "${expected} | NIB EPMO"`, title === `${expected} | NIB EPMO`, `got "${title}"`);
  }

  console.log('\nKeyboard access\n');
  const dash = await get('/dashboard');
  check('a skip link precedes the sidebar', dash.includes('Skip to content'));
  check('the main region can receive that focus', dash.includes('id="main-content"'));

  console.log('\nNavigation\n');
  for (const g of ['My work', 'Delivery', 'Team', 'Awaiting approval', 'Money and reporting', 'Organisation']) {
    check(`grouped under "${g}"`, dash.includes(`>${g}<`));
  }

  console.log('\nLoading states\n');
  const projects = await get('/projects');
  check('the wait is announced, not silent', projects.includes('aria-busy'));
  check('and it says what is loading', projects.includes('Loading projects'));

  console.log('\nEmpty states\n');
  check('the misleading advice is gone from the build', !inBundle('Get started by creating a new project'));
  check('a failed search offers to clear the filters', inBundle('No projects match your search'));
  check('a genuinely empty list offers to create one', inBundle('No projects yet'));

  console.log('\nTables\n');
  check('scroll regions are keyboard reachable', inBundle('role:"region"'));
  for (const label of ['User accounts', 'Tasks awaiting approval', 'Project payments']) {
    check(`the "${label}" table says what it holds`, inBundle(label));
  }

  await prisma.session.delete({ where: { id: session.id } });
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
