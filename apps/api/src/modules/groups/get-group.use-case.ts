import { Injectable } from '@nestjs/common';
import type { GroupView } from './dto/group.schemas.js';
import { GroupAccessService } from './group-access.service.js';
import { toGroupView } from './group.mapper.js';

@Injectable()
export class GetGroupUseCase {
    constructor(private readonly access: GroupAccessService) {}

    async execute(userId: string, groupId: string): Promise<GroupView> {
        return toGroupView(await this.access.assertCanRead(groupId, userId));
    }
}
