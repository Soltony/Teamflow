import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Tests cover the pure logic that correctness depends on — password hashing,
 * permission resolution, audit redaction, rate limiting, phone normalisation.
 * Anything needing a database or a running server lives in scripts/ and is run
 * against a real build; see docs/authentication.md.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` throws on import outside Next's server bundler, which
      // would make every module importing it untestable. The real guard still
      // applies to the build; this only affects the test runner.
      'server-only': path.resolve(__dirname, './src/lib/testing/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
