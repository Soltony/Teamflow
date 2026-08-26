import { readFileSync } from 'fs';
import path from 'path';

/**
 * Aborts if the running server is not serving the build in `.next`.
 *
 * The HTTP suites read server-action ids out of `.next`, so a server left over
 * from an earlier build answers with "Server action not found" and every test
 * fails at once. That looks exactly like a broken change and has sent this
 * investigation down the wrong path more than once. Checking the build id up
 * front turns a confusing wall of failures into one clear message.
 */
export async function assertServerMatchesBuild(base: string): Promise<void> {
  let localBuildId: string;
  try {
    localBuildId = readFileSync(path.join('.next', 'BUILD_ID'), 'utf8').trim();
  } catch {
    throw new Error('No .next/BUILD_ID found. Run "npx next build" first.');
  }

  let html: string;
  try {
    html = await fetch(`${base}/login`).then((r) => r.text());
  } catch {
    throw new Error(`No server responding at ${base}. Start one with "npx next start".`);
  }

  // Next embeds the build id in the bootstrap payload of every page.
  if (!html.includes(localBuildId)) {
    throw new Error(
      `The server at ${base} is serving a different build than .next.\n` +
        `  Expected build id: ${localBuildId}\n` +
        `  This usually means an older "next start" is still holding the port.\n` +
        `  Stop it, then start a fresh one:\n` +
        `    Get-NetTCPConnection -LocalPort ${new URL(base).port} -State Listen |\n` +
        `      Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }`,
    );
  }
}
