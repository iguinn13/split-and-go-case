import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import type { MemberInput, MemberView } from './dto/group.schemas.js';
import { GroupAccessService } from './group-access.service.js';
import { toMemberView } from './group.mapper.js';
import { GroupsRepository, isUniqueViolation } from './groups.repository.js';
import { findDuplicateMemberFields } from './member-uniqueness.js';

@Injectable()
export class AddMemberUseCase {
    constructor(
        private readonly access: GroupAccessService,
        private readonly groups: GroupsRepository,
    ) {}

    async execute(userId: string, groupId: string, input: MemberInput): Promise<MemberView> {
        const group = await this.access.assertIsOwner(groupId, userId);

        if (group.status === 'CLOSED') {
            throw new AppError('GROUP_CLOSED', 409, 'Group is closed');
        }

        const duplicates = findDuplicateMemberFields(group.members, [input], () => '');

        if (duplicates.length > 0) {
            throw new AppError('VALIDATION_ERROR', 422, 'Invalid request data', duplicates);
        }

        // RN-GRP-05: link to the registered user with the same email, if any.
        const linkedUserId = input.email
            ? ((await this.groups.findUserIdsByEmails([input.email])).get(input.email) ?? null)
            : null;

        if (linkedUserId && group.members.some((m) => m.userId === linkedUserId)) {
            throw new AppError('VALIDATION_ERROR', 422, 'Invalid request data', [
                { path: 'email', message: 'User is already a member of this group' },
            ]);
        }

        try {
            return toMemberView(
                await this.groups.addMember(groupId, {
                    name: input.name,
                    email: input.email,
                    userId: linkedUserId,
                }),
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('VALIDATION_ERROR', 422, 'Invalid request data', [
                    { path: 'name', message: 'Duplicate member' },
                ]);
            }

            throw error;
        }
    }
}
