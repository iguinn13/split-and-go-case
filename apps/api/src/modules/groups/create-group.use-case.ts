import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateGroupInput, GroupView } from './dto/group.schemas.js';
import { toGroupView } from './group.mapper.js';
import { GroupsRepository, isUniqueViolation } from './groups.repository.js';
import { findDuplicateMemberFields } from './member-uniqueness.js';

@Injectable()
export class CreateGroupUseCase {
  constructor(private readonly groups: GroupsRepository) {}

  async execute(userId: string, input: CreateGroupInput): Promise<GroupView> {
    const creator = await this.groups.findUserById(userId);
    if (!creator) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');

    // The creator is always the first, linked member (RF-GRP-02).
    const creatorIdentity = { name: creator.name, email: creator.email.toLowerCase() };
    const duplicates = findDuplicateMemberFields(
      [creatorIdentity],
      input.members,
      (index) => `members.${index}.`,
    );
    if (duplicates.length > 0) {
      throw new AppError('VALIDATION_ERROR', 422, 'Invalid request data', duplicates);
    }

    const userIds = await this.groups.findUserIdsByEmails(
      input.members.flatMap((m) => (m.email ? [m.email] : [])),
    );

    try {
      const group = await this.groups.createGroup({
        name: input.name,
        description: input.description,
        baseCurrency: input.baseCurrency,
        ownerId: userId,
        members: [
          { name: creator.name, email: creatorIdentity.email, userId },
          ...input.members.map((m) => ({
            name: m.name,
            email: m.email,
            userId: m.email ? (userIds.get(m.email) ?? null) : null,
          })),
        ],
      });
      return toGroupView(group);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('VALIDATION_ERROR', 422, 'Invalid request data', [
          { path: 'members', message: 'Duplicate member' },
        ]);
      }
      throw error;
    }
  }
}
