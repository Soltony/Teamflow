import { readdirSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Server-action ids are content hashes baked into the client bundle, so they
 * change on every build. The tests read them back out of `.next` rather than
 * hardcoding them, which would silently break after any code change.
 *
 * An id appears in the chunk for each route that can invoke that action, so
 * reading a route's chunk gives exactly the actions that route ships.
 */
function chunkTextFor(route: string): string {
  const dir = path.join('.next', 'static', 'chunks', 'app', ...route.split('/'));
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.startsWith('page-') && f.endsWith('.js'));
  } catch {
    throw new Error(`No built chunk for route "${route}". Run "npx next build" first.`);
  }
  if (!files.length) throw new Error(`No page chunk found in ${dir}.`);
  return files.map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n');
}

export function actionIdsFor(route: string): string[] {
  const matches = chunkTextFor(route).match(/"[0-9a-f]{40,42}"/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

/** A route that ships exactly one action, such as /login or /change-password. */
export function soleActionIdFor(route: string): string {
  const ids = actionIdsFor(route);
  if (ids.length !== 1) {
    throw new Error(
      `Expected route "${route}" to ship exactly one server action, found ${ids.length}: ${ids.join(', ')}`,
    );
  }
  return ids[0];
}
