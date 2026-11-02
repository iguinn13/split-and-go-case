import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which NestJS dependency injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
});
