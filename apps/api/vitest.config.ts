import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which NestJS dependency injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: false,
    environment: 'node',
    env: {
      DATABASE_URL:
        process.env['DATABASE_URL'] ?? 'postgresql://splitgo:splitgo@localhost:5432/splitgo',
      JWT_SECRET: process.env['JWT_SECRET'] ?? 'test-only-secret',
    },
    globalSetup: ['test/support/global-setup.ts'],
    setupFiles: ['test/support/no-network.setup.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
});
