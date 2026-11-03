import { Injectable } from '@nestjs/common';
import type { GroupView, UpdateGroupInput } from './dto/group.schemas.js';
import { GroupAccessService } from './group-access.service.js';
import { toGroupView } from './group.mapper.js';
import { GroupsRepository } from './groups.repository.js';

@Injectable()
export class UpdateGroupUseCase {
    constructor(
        private readonly access: GroupAccessService,
        private readonly groups: GroupsRepository,
    ) {}

    async execute(userId: string, groupId: string, input: UpdateGroupInput): Promise<GroupView> {
        await this.access.assertIsOwner(groupId, userId);

        return toGroupView(await this.groups.updateGroup(groupId, input));
    }
}
