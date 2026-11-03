import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { EXCHANGE_RATE_PROVIDER } from '../../src/modules/exchange-rates/exchange-rate-provider.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { FakeExchangeRateProvider } from './fake-exchange-rate.provider.js';

export const PASSWORD = 'password-123';

export interface TestUser {
    id: string;
    name: string;
    email: string;
    token: string;
}

/**
 * Removes everything owned by users of an e-mail domain. Children go first because shares
 * restrict member deletion.
 */
export async function cleanupEmailDomain(prisma: PrismaService, domain: string): Promise<void> {
    const where = { group: { owner: { email: { endsWith: domain } } } };

    await prisma.expenseShare.deleteMany({ where: { expense: where } });
    await prisma.expense.deleteMany({ where });
    await prisma.settlementTransfer.deleteMany({ where });
    await prisma.groupMember.deleteMany({ where });
    await prisma.group.deleteMany({ where: { owner: { email: { endsWith: domain } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: domain } } });
}

/**
 * Per-file e2e harness: the real AppModule with the exchange-rate provider replaced by a
 * fake (no network), a unique e-mail domain so parallel files and repeated runs never share
 * data, and a cleanup that removes only this harness' rows.
 */
export class E2eHarness {
    readonly fx = new FakeExchangeRateProvider();
    readonly domain: string;
    app!: INestApplication;
    prisma!: PrismaService;
    private readonly users = new Map<string, TestUser>();

    constructor(label: string) {
        this.domain = `-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@${label}.dev`;
    }

    server = (): Server => this.app.getHttpServer() as Server;

    async start(): Promise<void> {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(EXCHANGE_RATE_PROVIDER)
            .useValue(this.fx)
            .compile();

        this.app = moduleRef.createNestApplication();
        await this.app.init();
        this.prisma = this.app.get(PrismaService);
    }

    async stop(): Promise<void> {
        await cleanupEmailDomain(this.prisma, this.domain);
        await this.app.close();
    }

    email(name: string): string {
        return `${name}${this.domain}`;
    }

    /** Registers and logs in through the public endpoints. */
    async signUp(name: string): Promise<TestUser> {
        const email = this.email(name);

        await request(this.server())
            .post('/auth/register')
            .send({ name, email, password: PASSWORD })
            .expect(201);
        const login = await request(this.server())
            .post('/auth/login')
            .send({ email, password: PASSWORD })
            .expect(200);
        const body = login.body as { accessToken: string; user: { id: string } };
        const user = { id: body.user.id, name, email, token: body.accessToken };

        this.users.set(name, user);

        return user;
    }

    user(name: string): TestUser {
        const user = this.users.get(name);

        if (!user) throw new Error(`User ${name} was not signed up`);

        return user;
    }

    /** Authenticated request builders for a signed-up user; `null` sends no token. */
    as(name: string | null) {
        const withAuth = (req: request.Test): request.Test =>
            name === null ? req : req.set('Authorization', `Bearer ${this.user(name).token}`);
        const s = this.server();

        return {
            get: (url: string) => withAuth(request(s).get(url)),
            post: (url: string) => withAuth(request(s).post(url)),
            put: (url: string) => withAuth(request(s).put(url)),
            patch: (url: string) => withAuth(request(s).patch(url)),
            delete: (url: string) => withAuth(request(s).delete(url)),
        };
    }
}
