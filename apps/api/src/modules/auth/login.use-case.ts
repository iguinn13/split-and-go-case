import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../common/auth/authenticated-user.js';
import { AppError } from '../../common/errors/app-error.js';
import type { LoginInput, UserView } from './auth.schemas.js';
import { PasswordService } from './password.service.js';
import { UsersRepository } from './users.repository.js';

export interface LoginResult {
    accessToken: string;
    user: UserView;
}

@Injectable()
export class LoginUseCase {
    // Compared against when the email is unknown so both failures cost the same time.
    private dummyHash?: Promise<string>;

    constructor(
        private readonly users: UsersRepository,
        private readonly passwords: PasswordService,
        private readonly jwt: JwtService,
    ) {}

    async execute(input: LoginInput): Promise<LoginResult> {
        const user = await this.users.findByEmail(input.email);
        // RN-AUTH-05: same generic error whether the email or the password is wrong.
        const invalid = new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');

        if (!user) {
            this.dummyHash ??= this.passwords.hash('dummy-password-for-timing');
            await this.passwords.verify(input.password, await this.dummyHash);

            throw invalid;
        }

        if (!(await this.passwords.verify(input.password, user.passwordHash))) throw invalid;

        const payload: JwtPayload = { sub: user.id, email: user.email };

        return {
            accessToken: await this.jwt.signAsync(payload),
            user: { id: user.id, name: user.name, email: user.email },
        };
    }
}
