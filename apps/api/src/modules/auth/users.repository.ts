import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Creates the user and links pending group members with the same email (RN-GRP-05)
   * in one transaction. Returns null when the email is already taken.
   */
  async createAndLinkPendingMembers(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data });
        await tx.groupMember.updateMany({
          where: { email: { equals: data.email, mode: 'insensitive' }, userId: null },
          data: { userId: user.id },
        });
        return user;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }
}
