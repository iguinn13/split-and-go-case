import type { GroupMember } from '@prisma/client';
import type { GroupView, MemberView } from './dto/group.schemas.js';
import type { GroupWithMembers } from './groups.repository.js';

export function toMemberView(member: GroupMember): MemberView {
    return { id: member.id, name: member.name, email: member.email, userId: member.userId };
}

export function toGroupView(group: GroupWithMembers): GroupView {
    return {
        id: group.id,
        name: group.name,
        description: group.description,
        baseCurrency: group.baseCurrency,
        status: group.status,
        ownerId: group.ownerId,
        closedAt: group.closedAt,
        createdAt: group.createdAt,
        members: group.members.map(toMemberView),
    };
}
