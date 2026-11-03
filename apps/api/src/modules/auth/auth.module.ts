import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { AuthController } from './auth.controller.js';
import { GetMeUseCase } from './get-me.use-case.js';
import { LoginUseCase } from './login.use-case.js';
import { PasswordService } from './password.service.js';
import { RegisterUseCase } from './register.use-case.js';
import { UsersRepository } from './users.repository.js';

// RN-AUTH-04: access tokens expire in 24 hours.
export const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;

@Module({
    imports: [
        JwtModule.registerAsync({
            inject: [ENV],
            useFactory: (env: Env) => ({
                secret: env.JWT_SECRET,
                signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        UsersRepository,
        PasswordService,
        RegisterUseCase,
        LoginUseCase,
        GetMeUseCase,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
    ],
})
export class AuthModule {}
