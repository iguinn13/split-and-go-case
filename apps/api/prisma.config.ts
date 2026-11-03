import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env files by itself.
try {
    process.loadEnvFile();
} catch {
    // No .env file: rely on the process environment.
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        url: process.env['DATABASE_URL'] ?? '',
    },
});
