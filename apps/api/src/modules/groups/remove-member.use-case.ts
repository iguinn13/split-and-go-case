import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { GroupAccessService } from './group-access.service.js';
import { GroupsRepository } from './groups.repository.js';

@Injectable()
export class RemoveMemberUseCase {
  constructor(
    private readonly access: GroupAccessService,
    private readonly groups: GroupsRepository,
  ) {}

  async execute(userId: string, groupId: string, memberId: string): Promise<void> {
    const group = await this.access.assertIsOwner(groupId, userId);
    if (group.status === 'CLOSED') {
      throw new AppError('GROUP_CLOSED', 409, 'Group is closed');
    }

    const member = group.members.find((m) => m.id === memberId);
    if (!member) throw new AppError('MEMBER_NOT_FOUND', 404, 'Member not found');

    // RN-GRP-08
    if (member.userId === group.ownerId) {
      throw new AppError('FORBIDDEN', 403, 'The group owner cannot be removed');
    }
    // RN-GRP-07
    if (await this.groups.memberHasExpenses(memberId)) {
      throw new AppError('MEMBER_HAS_EXPENSES', 409, 'Member has expenses and cannot be removed');
    }
    await this.groups.deleteMember(memberId);
  }
}
