import { execFileSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');

/**
 * Isolated Docker Compose project for the e2e run: own project name and high ports so it
 * never collides with other containers on the machine (override with E2E_* variables).
 */
export const project = process.env.E2E_COMPOSE_PROJECT ?? 'splitgo-e2e';
export const webPort = Number(process.env.E2E_WEB_PORT ?? 13000);
export const apiPort = Number(process.env.E2E_API_PORT ?? 13001);
export const postgresPort = Number(process.env.E2E_POSTGRES_PORT ?? 15432);
export const webUrl = `http://localhost:${webPort}`;
export const apiUrl = `http://localhost:${apiPort}`;

export const composeFiles = [
    path.join(repoRoot, 'docker-compose.yml'),
    path.join(import.meta.dirname, '..', 'docker-compose.e2e.yml'),
];

const composeEnv = {
    ...process.env,
    WEB_PORT: String(webPort),
    API_PORT: String(apiPort),
    POSTGRES_PORT: String(postgresPort),
    CORS_ORIGIN: webUrl,
    JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-only-secret-not-for-production',
};

export function compose(args: string[]): void {
    execFileSync(
        'docker',
        ['compose', '-p', project, ...composeFiles.flatMap((f) => ['-f', f]), ...args],
        { cwd: repoRoot, env: composeEnv, stdio: 'inherit' },
    );
}

/** True when CI (or the developer) manages the stack outside of Playwright. */
export const externalStack = process.env.E2E_EXTERNAL_STACK === '1';
