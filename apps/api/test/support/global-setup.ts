import { execFileSync } from 'node:child_process';

/**
 * Runs once before the whole suite: applies the Prisma migrations to DATABASE_URL so the
 * e2e tests always run against an up-to-date schema (locally and in CI). Idempotent.
 */
export default function setup(): void {
  // Same default as vitest.config.ts.
  const url = process.env['DATABASE_URL'] ?? 'postgresql://splitgo:splitgo@localhost:5432/splitgo';
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: import.meta.dirname + '/../..',
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
