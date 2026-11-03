import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { EXCHANGE_RATE_PROVIDER } from '../src/modules/exchange-rates/exchange-rate-provider.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { cleanupEmailDomain } from './support/e2e-harness.js';
import { FakeExchangeRateProvider } from './support/fake-exchange-rate.provider.js';

describe('Currencies and exchange rates (e2e)', () => {
    let app: INestApplication;
    const fake = new FakeExchangeRateProvider();
    const domain = `-${Date.now()}@fx-e2e.dev`;
    const server = (): Server => app.getHttpServer() as Server;
    let auth: { Authorization: string };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(EXCHANGE_RATE_PROVIDER)
            .useValue(fake)
            .compile();

        app = moduleRef.createNestApplication();
        await app.init();
        const email = `fx${domain}`;

        await request(server())
            .post('/auth/register')
            .send({ name: 'Fx', email, password: 'password-123' })
            .expect(201);
        const login = await request(server())
            .post('/auth/login')
            .send({ email, password: 'password-123' })
            .expect(200);

        auth = { Authorization: `Bearer ${(login.body as { accessToken: string }).accessToken}` };
    });
    afterAll(async () => {
        await cleanupEmailDomain(app.get(PrismaService), domain);
        await app.close();
    });

    it('GET /currencies requires JWT', async () => {
        await request(server()).get('/currencies').expect(401);
        await request(server()).get('/exchange-rates?from=USD&to=BRL').expect(401);
    });

    it('GET /currencies returns the 10 currencies (AC-CUR-01)', async () => {
        const res = await request(server()).get('/currencies').set(auth).expect(200);
        const body = res.body as { code: string; name: string; minorUnits: number }[];

        expect(body).toHaveLength(10);
        expect(body.find((c) => c.code === 'JPY')).toMatchObject({ minorUnits: 0 });
        expect(body.find((c) => c.code === 'KRW')).toMatchObject({ minorUnits: 0 });
        expect(Object.keys(body[0]!).sort()).toEqual(['code', 'minorUnits', 'name']);
    });

    it('suggests a rate, text decimal, cached on second call (AC-CUR-12)', async () => {
        const url = '/exchange-rates?from=USD&to=BRL&date=2026-07-10';
        const res = await request(server()).get(url).set(auth).expect(200);

        expect(res.body).toEqual({
            from: 'USD',
            to: 'BRL',
            rate: '5.4325',
            date: '2026-07-10',
            source: 'fake',
        });
        await request(server()).get(url).set(auth).expect(200);
        expect(fake.calls).toHaveLength(1);
    });

    it('same currency returns "1" without calling the provider', async () => {
        const before = fake.calls.length;
        const res = await request(server())
            .get('/exchange-rates?from=BRL&to=BRL')
            .set(auth)
            .expect(200);

        expect((res.body as { rate: string }).rate).toBe('1');
        expect(fake.calls).toHaveLength(before);
    });

    it('validates query params with 422 VALIDATION_ERROR', async () => {
        for (const q of [
            '',
            '?from=USD',
            '?from=XYZ&to=BRL',
            '?from=USD&to=BRL&date=2026-13-40',
            '?from=USD&to=BRL&date=10/07/2026',
            '?from=USD&to=BRL&date=1998-12-31',
            '?from=USD&to=BRL&date=2999-01-01',
        ]) {
            const res = await request(server()).get(`/exchange-rates${q}`).set(auth).expect(422);

            expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR');
        }
    });

    it('provider failure returns 503 EXCHANGE_RATE_UNAVAILABLE (AC-CUR-13)', async () => {
        fake.failing = true;
        const res = await request(server())
            .get('/exchange-rates?from=EUR&to=GBP&date=2026-07-10')
            .set(auth)
            .expect(503);

        expect((res.body as { code: string }).code).toBe('EXCHANGE_RATE_UNAVAILABLE');
        expect(JSON.stringify(res.body)).not.toContain('secret');
        fake.failing = false;
    });
});
