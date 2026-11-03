import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../errors/app-error.js';
import type { JwtPayload } from './authenticated-user.js';
import type { RequestWithUser } from './current-user.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwt: JwtService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) return true;

        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const header = request.headers.authorization;

        if (!header?.startsWith(BEARER_PREFIX)) {
            throw new AppError('UNAUTHORIZED', 401, 'Missing or invalid access token');
        }

        let payload: JwtPayload;

        try {
            payload = await this.jwt.verifyAsync<JwtPayload>(
                header.slice(BEARER_PREFIX.length).trim(),
            );
        } catch {
            throw new AppError('UNAUTHORIZED', 401, 'Missing or invalid access token');
        }

        request.user = { id: payload.sub, email: payload.email };

        return true;
    }
}
