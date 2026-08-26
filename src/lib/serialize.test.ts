import { describe, expect, it } from 'vitest';

import { serialize } from './serialize';

/** What the codebase did before: the behaviour this must reproduce exactly. */
const roundTrip = (v: unknown) => JSON.parse(JSON.stringify(v));

/** Stands in for a Prisma Decimal without pulling in the runtime. */
class FakeDecimal {
  constructor(private readonly raw: string) {}
  toNumber() { return Number(this.raw); }
  toFixed(n: number) { return Number(this.raw).toFixed(n); }
  toString() { return this.raw; }
  toJSON() { return this.raw; }
}

describe('serialize', () => {
  it('turns a Date into the same ISO string JSON produces', () => {
    const d = new Date('2026-03-04T05:06:07.008Z');
    expect(serialize(d)).toBe('2026-03-04T05:06:07.008Z');
    expect(serialize(d)).toEqual(roundTrip(d));
  });

  it('turns a Decimal into its decimal string, not a float', () => {
    // A payment amount must not go through binary floating point on its way
    // to the client.
    const amount = new FakeDecimal('12345678.90');
    expect(serialize({ amount })).toEqual({ amount: '12345678.90' });
    expect(serialize({ amount })).toEqual(roundTrip({ amount }));
  });

  it('handles the shape a project query actually returns', () => {
    const project = {
      id: 'p1',
      name: 'Core Banking Upgrade',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      budget: new FakeDecimal('4500000.00'),
      manager: { id: 'u1', name: 'A', lastLogin: new Date('2026-02-02T00:00:00.000Z') },
      milestones: [
        { id: 'm1', dueDate: new Date('2026-06-30T00:00:00.000Z'), tasks: [{ id: 't1', done: true }] },
        { id: 'm2', dueDate: null, tasks: [] },
      ],
    };
    expect(serialize(project)).toEqual(roundTrip(project));
  });

  describe('matches JSON.stringify on the awkward cases', () => {
    const cases: Array<[string, unknown]> = [
      ['null', null],
      ['a plain string', 'hello'],
      ['zero', 0],
      ['false', false],
      ['an empty object', {}],
      ['an empty array', []],
      ['nested empties', { a: [], b: {}, c: [[], {}] }],
      ['undefined inside an object', { a: 1, b: undefined }],
      ['undefined inside an array', [1, undefined, 3]],
      ['a function inside an object', { a: 1, fn: () => 1 }],
      ['a function inside an array', [1, () => 1, 3]],
      ['NaN', { n: NaN }],
      ['Infinity', { n: Infinity, m: -Infinity }],
      ['a nested null', { a: { b: null } }],
      ['an array of dates', [new Date('2026-01-01'), new Date('2026-02-01')]],
      ['a deeply nested date', { a: { b: { c: { d: new Date('2026-01-01') } } } }],
      ['a Map, which JSON renders as an empty object', { m: new Map([['a', 1]]) }],
      ['a Set', { s: new Set([1, 2]) }],
      ['an object with its own toJSON', { x: { toJSON: () => ({ replaced: true }) } }],
      ['a string holding a quote', { s: 'he said "hi"' }],
      ['a string holding a newline', { s: 'a\nb' }],
      ['unicode', { s: 'ሰላም ዓለም' }],
      ['a very negative number', { n: -1e300 }],
    ];

    for (const [name, value] of cases) {
      it(name, () => {
        expect(serialize(value)).toEqual(roundTrip(value));
      });
    }
  });

  it('agrees with JSON on a thousand randomly generated structures', () => {
    // The cases above are the ones I thought of. This covers the ones I did not.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const build = (depth: number): unknown => {
      const pick = Math.floor(rand() * 10);
      if (depth > 3 || pick < 2) return Math.floor(rand() * 1000);
      if (pick === 2) return `s${Math.floor(rand() * 100)}`;
      if (pick === 3) return rand() > 0.5;
      if (pick === 4) return null;
      if (pick === 5) return new Date(Math.floor(rand() * 1e12));
      if (pick === 6) return new FakeDecimal((rand() * 1e6).toFixed(2));
      if (pick === 7) return undefined;
      if (pick === 8) {
        return Array.from({ length: Math.floor(rand() * 4) }, () => build(depth + 1));
      }
      const out: Record<string, unknown> = {};
      for (let i = 0; i < Math.floor(rand() * 4); i++) out[`k${i}`] = build(depth + 1);
      return out;
    };

    for (let i = 0; i < 1000; i++) {
      // Wrapped, because JSON.stringify(undefined) returns undefined rather
      // than a string and there is nothing to compare at the top level.
      const value = { root: build(0) };
      expect(serialize(value), JSON.stringify(value)).toEqual(roundTrip(value));
    }
  });

  it('refuses a circular structure, as JSON does', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(() => serialize(a)).toThrow(/circular/i);
    expect(() => roundTrip(a)).toThrow(/circular/i);
  });

  it('allows the same object to appear twice without calling it circular', () => {
    // A shared reference is not a cycle. Prisma returns these constantly —
    // the same user as both manager and assignee.
    const user = { id: 'u1', joined: new Date('2026-01-01T00:00:00.000Z') };
    const value = { manager: user, assignee: user };
    expect(serialize(value)).toEqual(roundTrip(value));
  });

  it('refuses a BigInt, as JSON does', () => {
    // BigInt(1) rather than 1n: the tsconfig target predates BigInt literals.
    expect(() => serialize({ n: BigInt(1) })).toThrow(TypeError);
  });

  it('returns a copy, leaving the server-side value untouched', () => {
    const original = { when: new Date('2026-01-01T00:00:00.000Z'), nested: { a: 1 } };
    const result = serialize(original);
    expect(original.when).toBeInstanceOf(Date);
    (result.nested as { a: number }).a = 2;
    expect(original.nested.a).toBe(1);
  });
});
