import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import type { RegisterInput, UserView } from './auth.schemas.js';
import { PasswordService } from './password.service.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class RegisterUseCase {
    constructor(
        private readonly users: UsersRepository,
        private readonly passwords: PasswordService,
    ) {}

    async execute(input: RegisterInput): Promise<UserView> {
        const conflict = new AppError('EMAIL_ALREADY_IN_USE', 409, 'Email is already in use');

        if (await this.users.findByEmail(input.email)) throw conflict;

        const user = await this.users.createAndLinkPendingMembers({
            name: input.name,
            email: input.email,
            passwordHash: await this.passwords.hash(input.password),
        });

        if (!user) throw conflict;

        return { id: user.id, name: user.name, email: user.email };
    }
}
