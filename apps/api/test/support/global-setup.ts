import { execFileSync } from 'node:child_process';
import { resolveTestDatabaseUrl } from './test-database.js';

/**
 * Runs once before the whole suite: applies the Prisma migrations to DATABASE_URL so the
 * e2e tests always run against an up-to-date schema (locally and in CI). Idempotent.
 * The URL is validated first (see test-database.ts), so migrations never reach another database.
 */
export default function setup(): void {
  const url = resolveTestDatabaseUrl(process.env);
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: import.meta.dirname + '/../..',
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
