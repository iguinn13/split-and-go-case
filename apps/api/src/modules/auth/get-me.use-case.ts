import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { AppError } from '../../common/errors/app-error.js';
import type { UserView } from './auth.schemas.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class GetMeUseCase {
    constructor(private readonly users: UsersRepository) {}

    async execute(current: AuthenticatedUser): Promise<UserView> {
        const user = await this.users.findById(current.id);

        // A valid token for a deleted user is no longer an authenticated session.
        if (!user) throw new AppError('UNAUTHORIZED', 401, 'Missing or invalid access token');

        return { id: user.id, name: user.name, email: user.email };
    }
}
