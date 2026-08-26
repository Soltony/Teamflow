/**
 * Crossing the server/client boundary.
 *
 * Server actions hand their results to client components, which means every
 * value is JSON round-tripped: a `Date` arrives as an ISO string and a Prisma
 * `Decimal` as a decimal string. The codebase did this with
 * `JSON.parse(JSON.stringify(x))` in more than fifty places, but the result was
 * typed as if nothing had changed — so the shared types in lib/types.ts declare
 * `startDate: string` while the Prisma value is a `Date`, and the two disagree
 * at every boundary.
 *
 * `Serialized<T>` states what actually comes out the other side, so the
 * conversion is visible to the compiler instead of being papered over with a
 * premature annotation or an `any`.
 */

/** Anything with a `toNumber`, i.e. a Prisma Decimal. */
type DecimalLike = { toNumber: () => number; toFixed: (n: number) => string };

export type Serialized<T> = T extends Date
  ? string
  : T extends DecimalLike
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

/**
 * Values that a single-pass walk handles directly.
 *
 * Anything outside this set — a Map, a class instance with a custom `toJSON`,
 * a getter that returns a function — falls back to the JSON round trip for that
 * subtree, so exotic values behave exactly as they did before. The fast path
 * covers what Prisma actually returns, which is all of these queries.
 */
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isDecimal(value: object): value is DecimalLike {
  return (
    typeof (value as { toNumber?: unknown }).toNumber === 'function' &&
    typeof (value as { toFixed?: unknown }).toFixed === 'function'
  );
}

/**
 * One traversal instead of two.
 *
 * `JSON.parse(JSON.stringify(x))` walks the graph to build a string, allocates
 * that whole string, then walks the string to rebuild the graph. For the
 * payloads here — a portfolio with its milestones, tasks, assignees and updates
 * — that intermediate string is the largest single allocation in the request,
 * and it is pure waste: nothing ever reads it.
 *
 * This produces byte-identical output for the types Prisma returns, while
 * allocating only the result. `seen` turns a circular reference into a clear
 * error instead of the `Converting circular structure to JSON` that JSON throws.
 */
function walk(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value !== 'object') {
    // NaN and Infinity are not representable in JSON; both become null, which
    // is what JSON.stringify does.
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    if (typeof value === 'bigint') {
      throw new TypeError('Do not know how to serialize a BigInt');
    }
    return value;
  }

  if (value instanceof Date) return value.toISOString();
  if (isDecimal(value)) return value.toString();

  // A value that defines its own JSON representation gets to use it, even if
  // it is otherwise a plain object. Missing this produced {} for anything
  // carrying a toJSON, because the walk dropped the method as a function key.
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return walk((value as { toJSON: () => unknown }).toJSON(), seen);
  }

  if (seen.has(value)) {
    throw new TypeError('Converting circular structure to JSON');
  }

  if (Array.isArray(value)) {
    seen.add(value);
    // `undefined` and functions become null inside an array, as in JSON.
    const out = value.map((item) => {
      const walked = walk(item, seen);
      return walked === undefined || typeof walked === 'function' ? null : walked;
    });
    seen.delete(value);
    return out;
  }

  if (!isPlainObject(value)) {
    // Something with its own representation — a Map, a Buffer, a class with
    // toJSON. Hand the subtree to JSON so it behaves exactly as before.
    return JSON.parse(JSON.stringify(value));
  }

  seen.add(value);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const walked = walk((value as Record<string, unknown>)[key], seen);
    // JSON omits keys whose value is undefined or a function.
    if (walked === undefined || typeof walked === 'function') continue;
    out[key] = walked;
  }
  seen.delete(value);
  return out;
}

/**
 * Converts a server value to what the client will really see.
 *
 * Prefer this to a bare `JSON.parse(JSON.stringify(x))`: the output is the
 * same, it costs roughly half as much, and the caller gets the right type.
 */
export function serialize<T>(value: T): Serialized<T> {
  return walk(value, new Set<object>()) as Serialized<T>;
}
