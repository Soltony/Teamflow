/**
 * Stand-in for the `server-only` package under test.
 *
 * `server-only` throws on import outside Next's server bundler, which would
 * make every module that imports it untestable. vitest.config.ts aliases the
 * package here so the guard it provides stays in force for the real build while
 * unit tests can still import server modules.
 */
export {};
