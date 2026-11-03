import { Injectable } from '@nestjs/common';
import { Prisma, type Group, type GroupMember } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export type GroupWithMembers = Group & { members: GroupMember[] };

@Injectable()
export class GroupsRepository {
    constructor(private readonly prisma: PrismaService) {}

    findWithMembers(groupId: string): Promise<GroupWithMembers | null> {
        return this.prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
        });
    }

    listForUser(userId: string) {
        return this.prisma.group.findMany({
            where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
            select: {
                id: true,
                name: true,
                baseCurrency: true,
                status: true,
                createdAt: true,
                _count: { select: { members: true } },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        });
    }

    findUserById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true, email: true },
        });
    }

    async findUserIdsByEmails(emails: string[]): Promise<Map<string, string>> {
        if (emails.length === 0) return new Map();

        const users = await this.prisma.user.findMany({
            where: {
                OR: emails.map((email) => ({ email: { equals: email, mode: 'insensitive' } })),
            },
            select: { id: true, email: true },
        });

        return new Map(users.map((user) => [user.email.toLowerCase(), user.id]));
    }

    createGroup(data: {
        name: string;
        description: string | null;
        baseCurrency: string;
        ownerId: string;
        members: { name: string; email: string | null; userId: string | null }[];
    }): Promise<GroupWithMembers> {
        const { members, ...group } = data;
        // Explicit increasing timestamps keep the creator first (a transaction shares one now()).
        const base = Date.now();

        return this.prisma.group.create({
            data: {
                ...group,
                members: {
                    create: members.map((m, i) => ({ ...m, createdAt: new Date(base + i) })),
                },
            },
            include: { members: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
        });
    }

    updateGroup(groupId: string, data: { name?: string; description?: string | null }) {
        return this.prisma.group.update({
            where: { id: groupId },
            data,
            include: { members: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
        });
    }

    addMember(
        groupId: string,
        data: { name: string; email: string | null; userId: string | null },
    ): Promise<GroupMember> {
        return this.prisma.groupMember.create({ data: { groupId, ...data } });
    }

    findMember(groupId: string, memberId: string): Promise<GroupMember | null> {
        return this.prisma.groupMember.findFirst({ where: { id: memberId, groupId } });
    }

    /**
     * Minimal check until the expenses module exposes its own service:
     * is the member the payer or a participant of any expense?
     */
    async memberHasExpenses(memberId: string): Promise<boolean> {
        const count = await this.prisma.expense.count({
            where: { OR: [{ paidByMemberId: memberId }, { shares: { some: { memberId } } }] },
        });

        return count > 0;
    }

    async deleteMember(memberId: string): Promise<void> {
        await this.prisma.groupMember.delete({ where: { id: memberId } });
    }
}

export function isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
