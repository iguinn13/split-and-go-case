import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { resolveTestDatabaseUrl } from './test/support/test-database.js';

// SWC emits decorator metadata, which NestJS dependency injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: false,
    environment: 'node',
    env: {
      // Throws (aborting the run) unless DATABASE_URL is explicit and local/test-like.
      DATABASE_URL: resolveTestDatabaseUrl(process.env),
      JWT_SECRET: process.env['JWT_SECRET'] ?? 'test-only-secret',
    },
    globalSetup: ['test/support/global-setup.ts'],
    setupFiles: ['test/support/no-network.setup.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
});
