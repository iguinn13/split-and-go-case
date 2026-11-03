import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.module.js';
import { GetMeUseCase } from './get-me.use-case.js';
import { LoginUseCase } from './login.use-case.js';
import { PasswordService } from './password.service.js';
import { RegisterUseCase } from './register.use-case.js';
import type { UsersRepository } from './users.repository.js';

const passwords = new PasswordService();
const jwt = new JwtService({
    secret: 'unit-secret',
    signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
});

function repo(overrides: Partial<Record<keyof UsersRepository, unknown>> = {}): UsersRepository {
    return {
        findByEmail: vi.fn().mockResolvedValue(null),
        findById: vi.fn().mockResolvedValue(null),
        createAndLinkPendingMembers: vi.fn(),
        ...overrides,
    } as unknown as UsersRepository;
}

async function expectAppError(promise: Promise<unknown>, code: string, status: number) {
    await expect(promise).rejects.toMatchObject({ code, statusCode: status });
    await expect(promise).rejects.toBeInstanceOf(AppError);
}

describe('auth use cases', () => {
    let user: User;

    beforeAll(async () => {
        user = {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Ana',
            email: 'ana@example.com',
            passwordHash: await passwords.hash('correct-password'),
            createdAt: new Date(),
        };
    });

    it('hashes with bcrypt cost 12 and never stores the plain password', () => {
        expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
        expect(user.passwordHash).not.toContain('correct-password');
    });

    describe('RegisterUseCase', () => {
        it('creates the user and returns it without the hash', async () => {
            const create = vi
                .fn<(data: { passwordHash: string }) => Promise<User>>()
                .mockResolvedValue(user);
            const useCase = new RegisterUseCase(
                repo({ createAndLinkPendingMembers: create }),
                passwords,
            );
            const result = await useCase.execute({
                name: 'Ana',
                email: 'ana@example.com',
                password: 'correct-password',
            });

            expect(result).toEqual({ id: user.id, name: 'Ana', email: 'ana@example.com' });
            expect(create.mock.calls[0]?.[0]?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
        });

        it('rejects an existing email', async () => {
            const useCase = new RegisterUseCase(
                repo({ findByEmail: vi.fn().mockResolvedValue(user) }),
                passwords,
            );

            await expectAppError(
                useCase.execute({ name: 'Ana', email: 'ana@example.com', password: 'whatever-1' }),
                'EMAIL_ALREADY_IN_USE',
                409,
            );
        });

        it('rejects when a concurrent insert wins the unique constraint', async () => {
            const useCase = new RegisterUseCase(
                repo({ createAndLinkPendingMembers: vi.fn().mockResolvedValue(null) }),
                passwords,
            );

            await expectAppError(
                useCase.execute({ name: 'Ana', email: 'ana@example.com', password: 'whatever-1' }),
                'EMAIL_ALREADY_IN_USE',
                409,
            );
        });
    });

    describe('LoginUseCase', () => {
        const login = (r: UsersRepository) => new LoginUseCase(r, passwords, jwt);

        it('returns a 24h token carrying sub and email, plus the user', async () => {
            const result = await login(
                repo({ findByEmail: vi.fn().mockResolvedValue(user) }),
            ).execute({
                email: 'ana@example.com',
                password: 'correct-password',
            });

            expect(result.user).toEqual({ id: user.id, name: 'Ana', email: 'ana@example.com' });
            const payload = jwt.decode<{ sub: string; email: string; iat: number; exp: number }>(
                result.accessToken,
            );

            expect(payload.sub).toBe(user.id);
            expect(payload.email).toBe('ana@example.com');
            expect(payload.exp - payload.iat).toBe(86400);
        });

        it('returns the same error for a wrong password and an unknown email', async () => {
            const wrongPassword = login(
                repo({ findByEmail: vi.fn().mockResolvedValue(user) }),
            ).execute({
                email: 'ana@example.com',
                password: 'wrong-password',
            });
            const unknownEmail = login(repo()).execute({
                email: 'x@example.com',
                password: 'whatever',
            });
            const [a, b] = await Promise.all([
                wrongPassword.catch((e: AppError) => e),
                unknownEmail.catch((e: AppError) => e),
            ]);

            expect(a).toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
            expect(b).toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
            expect((a as AppError).message).toBe((b as AppError).message);
        });
    });

    describe('GetMeUseCase', () => {
        it('returns the user', async () => {
            const useCase = new GetMeUseCase(repo({ findById: vi.fn().mockResolvedValue(user) }));

            expect(await useCase.execute({ id: user.id, email: user.email })).toEqual({
                id: user.id,
                name: 'Ana',
                email: 'ana@example.com',
            });
        });

        it('rejects when the user no longer exists', async () => {
            await expectAppError(
                new GetMeUseCase(repo()).execute({ id: user.id, email: user.email }),
                'UNAUTHORIZED',
                401,
            );
        });
    });
});
