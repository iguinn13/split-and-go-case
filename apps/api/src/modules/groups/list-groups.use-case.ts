import { Injectable } from '@nestjs/common';
import type { GroupSummaryView } from './dto/group.schemas.js';
import { GroupsRepository } from './groups.repository.js';

@Injectable()
export class ListGroupsUseCase {
  constructor(private readonly groups: GroupsRepository) {}

  async execute(userId: string): Promise<GroupSummaryView[]> {
    const groups = await this.groups.listForUser(userId);
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      baseCurrency: g.baseCurrency,
      status: g.status,
      memberCount: g._count.members,
      createdAt: g.createdAt,
    }));
  }
}
