import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { GroupsRepository, type GroupWithMembers } from './groups.repository.js';

/**
 * Group authorization shared by every module with group-scoped endpoints.
 * Users without a link to the group get 404 so its existence is not revealed (RN-GRP-10).
 */
@Injectable()
export class GroupAccessService {
    constructor(private readonly groups: GroupsRepository) {}

    async assertCanRead(groupId: string, userId: string): Promise<GroupWithMembers> {
        const group = await this.groups.findWithMembers(groupId);
        const linked =
            group && (group.ownerId === userId || group.members.some((m) => m.userId === userId));

        if (!group || !linked) throw new AppError('GROUP_NOT_FOUND', 404, 'Group not found');

        return group;
    }

    /** Only the owner passes; a linked non-owner gets 403, a stranger 404. */
    async assertIsOwner(groupId: string, userId: string): Promise<GroupWithMembers> {
        const group = await this.assertCanRead(groupId, userId);

        if (group.ownerId !== userId) {
            throw new AppError('FORBIDDEN', 403, 'Only the group owner can perform this action');
        }

        return group;
    }
}
