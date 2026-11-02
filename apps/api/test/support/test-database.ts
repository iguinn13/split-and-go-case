/**
 * Single source of truth for the database the API test suite may touch.
 *
 * The suite runs `prisma migrate deploy` and deletes rows, so it must never point at a
 * database that is not local or disposable. There is NO default URL: DATABASE_URL has to be
 * set explicitly, and it must satisfy every rule below (no escape hatch).
 *
 *  - protocol: postgres:// or postgresql://
 *  - host: localhost, 127.0.0.1, ::1, or the compose service names `postgres` / `db`
 *  - database name: must not look like production (prod, production, live, staging, main)
 */
export const EXAMPLE_DATABASE_URL = 'postgresql://splitgo:splitgo@localhost:5432/splitgo_test';

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', 'postgres', 'db']);
const FORBIDDEN_DB_NAME = /(^|[^a-z])(prod|production|live|staging|main)([^a-z]|$)/i;

export class UnsafeTestDatabaseError extends Error {
  constructor(reason: string) {
    super(
      `Refusing to run the API tests: ${reason}.\n` +
        `Recusando rodar os testes da API: defina DATABASE_URL explicitamente para um banco local ou descartavel, ` +
        `por exemplo:\n  DATABASE_URL=${EXAMPLE_DATABASE_URL} pnpm test\n` +
        `(host permitido: localhost, 127.0.0.1, ::1, postgres, db; o nome do banco nao pode parecer producao).`,
    );
    this.name = 'UnsafeTestDatabaseError';
  }
}

/**
 * Returns the validated URL or throws UnsafeTestDatabaseError. Error messages only ever
 * include the host and database name, never the raw URL, user or password.
 */
export function resolveTestDatabaseUrl(env: Record<string, string | undefined>): string {
  const raw = env['DATABASE_URL']?.trim();
  if (!raw) throw new UnsafeTestDatabaseError('DATABASE_URL is not set');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeTestDatabaseError('DATABASE_URL is not a valid URL');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new UnsafeTestDatabaseError('DATABASE_URL must use the postgresql:// protocol');
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new UnsafeTestDatabaseError(`host "${url.hostname}" is not a local or test host`);
  }
  let dbName: string;
  try {
    dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  } catch {
    throw new UnsafeTestDatabaseError('DATABASE_URL has an invalid database name');
  }
  if (!dbName) throw new UnsafeTestDatabaseError('DATABASE_URL has no database name');
  if (FORBIDDEN_DB_NAME.test(dbName)) {
    throw new UnsafeTestDatabaseError(`database "${dbName}" looks like a production database`);
  }
  return raw;
}
