import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { Public } from '../../common/auth/public.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import {
    type LoginInput,
    type RegisterInput,
    type UserView,
    loginSchema,
    registerSchema,
} from './auth.schemas.js';
import { GetMeUseCase } from './get-me.use-case.js';
import { type LoginResult, LoginUseCase } from './login.use-case.js';
import { RegisterUseCase } from './register.use-case.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly registerUseCase: RegisterUseCase,
        private readonly loginUseCase: LoginUseCase,
        private readonly getMeUseCase: GetMeUseCase,
    ) {}

    @Public()
    @Post('register')
    register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput): Promise<UserView> {
        return this.registerUseCase.execute(body);
    }

    @Public()
    @Post('login')
    @HttpCode(200)
    login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<LoginResult> {
        return this.loginUseCase.execute(body);
    }

    @Get('me')
    me(@CurrentUser() user: AuthenticatedUser): Promise<UserView> {
        return this.getMeUseCase.execute(user);
    }
}
