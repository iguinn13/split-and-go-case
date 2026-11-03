import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Auth (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    const suffix = `${Date.now()}`;
    const email = (name: string) => `${name}-${suffix}@auth-e2e.dev`;
    const server = (): Server => app.getHttpServer() as Server;
    const register = (body: object) => request(server()).post('/auth/register').send(body);

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = moduleRef.createNestApplication();
        await app.init();
        prisma = app.get(PrismaService);
    });

    afterAll(async () => {
        await prisma.groupMember.deleteMany({ where: { group: { name: `auth-e2e-${suffix}` } } });
        await prisma.group.deleteMany({ where: { name: `auth-e2e-${suffix}` } });
        await prisma.user.deleteMany({ where: { email: { endsWith: `-${suffix}@auth-e2e.dev` } } });
        await app.close();
    });

    it('AC-AUTH-01: registers a user without exposing password or hash', async () => {
        const res = await register({
            name: ' Ana ',
            email: email('ana'),
            password: 'password-123',
        }).expect(201);

        expect(res.body).toEqual({
            id: expect.any(String) as string,
            name: 'Ana',
            email: email('ana'),
        });
        const stored = await prisma.user.findUniqueOrThrow({ where: { email: email('ana') } });

        expect(stored.passwordHash).not.toBe('password-123');
    });

    it('AC-AUTH-02: rejects a duplicate email regardless of case', async () => {
        const res = await register({
            name: 'Ana 2',
            email: email('ana').toUpperCase(),
            password: 'password-123',
        }).expect(409);

        expect(res.body).toMatchObject({ statusCode: 409, code: 'EMAIL_ALREADY_IN_USE' });
    });

    it('AC-AUTH-03: validates input', async () => {
        const res = await register({ name: ' ', email: 'not-an-email', password: 'short' }).expect(
            422,
        );

        expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
        const paths = (res.body as { details: { path: string }[] }).details.map((d) => d.path);

        expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    });

    it('AC-AUTH-04: logs in and /auth/me returns the user', async () => {
        const res = await request(server())
            .post('/auth/login')
            .send({ email: email('ana').toUpperCase(), password: 'password-123' })
            .expect(200);

        expect(res.body).toEqual({
            accessToken: expect.any(String) as string,
            user: { id: expect.any(String) as string, name: 'Ana', email: email('ana') },
        });
        const me = await request(server())
            .get('/auth/me')
            .set('Authorization', `Bearer ${(res.body as { accessToken: string }).accessToken}`)
            .expect(200);

        expect(me.body).toEqual((res.body as { user: unknown }).user);
        expect(JSON.stringify(me.body)).not.toMatch(/passwordHash/i);
    });

    it('AC-AUTH-05: wrong password and unknown email give the same 401', async () => {
        const wrong = await request(server())
            .post('/auth/login')
            .send({ email: email('ana'), password: 'wrong-password' })
            .expect(401);
        const unknown = await request(server())
            .post('/auth/login')
            .send({ email: email('ghost'), password: 'password-123' })
            .expect(401);

        expect(wrong.body).toEqual(unknown.body);
        expect(wrong.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('AC-AUTH-06: protected routes reject missing, tampered and expired tokens', async () => {
        const missing = await request(server()).get('/auth/me').expect(401);

        expect(missing.body).toMatchObject({ code: 'UNAUTHORIZED' });

        const login = await request(server())
            .post('/auth/login')
            .send({ email: email('ana'), password: 'password-123' });
        const token = (login.body as { accessToken: string }).accessToken;
        const tampered = `${token.slice(0, -3)}${token.endsWith('aaa') ? 'bbb' : 'aaa'}`;

        await request(server())
            .get('/auth/me')
            .set('Authorization', `Bearer ${tampered}`)
            .expect(401);

        const user = (login.body as { user: { id: string } }).user;
        const expired = await new JwtService({ secret: process.env['JWT_SECRET'] }).signAsync(
            { sub: user.id, email: email('ana') },
            { expiresIn: -10 },
        );
        const res = await request(server())
            .get('/auth/me')
            .set('Authorization', `Bearer ${expired}`)
            .expect(401);

        expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('keeps /health public', async () => {
        await request(server()).get('/health').expect(200);
    });

    it('AC-AUTH-07: links pending group members with the same email on registration', async () => {
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: email('ana') } });
        const group = await prisma.group.create({
            data: {
                name: `auth-e2e-${suffix}`,
                ownerId: owner.id,
                members: { create: [{ name: 'Bia', email: email('bia') }] },
            },
        });
        const res = await register({
            name: 'Bia',
            email: email('bia'),
            password: 'password-123',
        }).expect(201);
        const member = await prisma.groupMember.findFirstOrThrow({ where: { groupId: group.id } });

        expect(member.userId).toBe((res.body as { id: string }).id);
    });
});
