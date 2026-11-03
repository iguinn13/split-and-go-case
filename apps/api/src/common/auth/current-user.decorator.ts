import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../errors/app-error.js';
import type { AuthenticatedUser } from './authenticated-user.js';

export type RequestWithUser = Request & { user?: AuthenticatedUser };

/** Injects the user authenticated by `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
        const user = context.switchToHttp().getRequest<RequestWithUser>().user;

        if (!user) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');

        return user;
    },
);
