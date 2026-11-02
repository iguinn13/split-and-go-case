import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Components are rendered to static markup in tests; tsconfig keeps `jsx: preserve` for Next.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: { environment: 'node', include: ['src/**/*.spec.ts'] },
});
