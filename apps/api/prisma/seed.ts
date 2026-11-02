import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SplitType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed the database');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

// Fixed ids make the seed idempotent: re-running it converges to the same state.
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_GROUP_ID = '00000000-0000-4000-8000-000000000002';
const MEMBER_IDS = {
  demo: '00000000-0000-4000-8000-000000000011',
  ana: '00000000-0000-4000-8000-000000000012',
  bruno: '00000000-0000-4000-8000-000000000013',
} as const;

interface ShareSeed {
  memberId: string;
  originalAmountMinor: number;
  amountMinor: number;
  basisPoints?: number;
}

interface ExpenseSeed {
  description: string;
  currency: string;
  originalAmountMinor: number;
  exchangeRate: string;
  amountMinor: number;
  paidByMemberId: string;
  splitType: SplitType;
  occurredOn: string;
  shares: ShareSeed[];
}

const { demo, ana, bruno } = MEMBER_IDS;

const expenses: ExpenseSeed[] = [
  {
    description: 'Dinner (equal split)',
    currency: 'BRL',
    originalAmountMinor: 9000,
    exchangeRate: '1',
    amountMinor: 9000,
    paidByMemberId: demo,
    splitType: SplitType.EQUAL,
    occurredOn: '2026-07-01',
    shares: [demo, ana, bruno].map((memberId) => ({
      memberId,
      originalAmountMinor: 3000,
      amountMinor: 3000,
    })),
  },
  {
    description: 'Car rental (percentage split)',
    currency: 'BRL',
    originalAmountMinor: 10000,
    exchangeRate: '1',
    amountMinor: 10000,
    paidByMemberId: ana,
    splitType: SplitType.PERCENTAGE,
    occurredOn: '2026-07-02',
    shares: [
      { memberId: demo, originalAmountMinor: 5000, amountMinor: 5000, basisPoints: 5000 },
      { memberId: ana, originalAmountMinor: 3000, amountMinor: 3000, basisPoints: 3000 },
      { memberId: bruno, originalAmountMinor: 2000, amountMinor: 2000, basisPoints: 2000 },
    ],
  },
  {
    description: 'Groceries (fixed split)',
    currency: 'BRL',
    originalAmountMinor: 6000,
    exchangeRate: '1',
    amountMinor: 6000,
    paidByMemberId: bruno,
    splitType: SplitType.FIXED,
    occurredOn: '2026-07-03',
    shares: [
      { memberId: demo, originalAmountMinor: 3000, amountMinor: 3000 },
      { memberId: ana, originalAmountMinor: 2000, amountMinor: 2000 },
      { memberId: bruno, originalAmountMinor: 1000, amountMinor: 1000 },
    ],
  },
  {
    // USD 100.00 at 5.4325 = BRL 543.25; the remainder cent goes to the first member.
    description: 'Museum tickets in USD (equal split, foreign currency)',
    currency: 'USD',
    originalAmountMinor: 10000,
    exchangeRate: '5.4325',
    amountMinor: 54325,
    paidByMemberId: demo,
    splitType: SplitType.EQUAL,
    occurredOn: '2026-07-04',
    shares: [
      { memberId: demo, originalAmountMinor: 3334, amountMinor: 18109 },
      { memberId: ana, originalAmountMinor: 3333, amountMinor: 18108 },
      { memberId: bruno, originalAmountMinor: 3333, amountMinor: 18108 },
    ],
  },
];

// Same algorithm and cost as the API (RN-AUTH-02), so the demo user can log in.
const BCRYPT_COST = 12;

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      name: 'Demo User',
      email: 'demo@splitandgo.dev',
      passwordHash: await bcrypt.hash('demo-password-123', BCRYPT_COST),
    },
  });

  await prisma.group.upsert({
    where: { id: DEMO_GROUP_ID },
    update: {},
    create: {
      id: DEMO_GROUP_ID,
      name: 'Weekend Trip',
      description: 'Sample group created by the seed',
      baseCurrency: 'BRL',
      ownerId: DEMO_USER_ID,
    },
  });

  const members = [
    { id: demo, name: 'Demo User', email: 'demo@splitandgo.dev', userId: DEMO_USER_ID },
    { id: ana, name: 'Ana', email: null, userId: null },
    { id: bruno, name: 'Bruno', email: null, userId: null },
  ];
  for (const member of members) {
    await prisma.groupMember.upsert({
      where: { id: member.id },
      update: {},
      create: { ...member, groupId: DEMO_GROUP_ID },
    });
  }

  // Expenses are replaced wholesale (shares cascade) so re-running never duplicates them.
  await prisma.expense.deleteMany({ where: { groupId: DEMO_GROUP_ID } });
  for (const { shares, occurredOn, ...expense } of expenses) {
    await prisma.expense.create({
      data: {
        ...expense,
        groupId: DEMO_GROUP_ID,
        occurredOn: new Date(`${occurredOn}T00:00:00.000Z`),
        createdByUserId: DEMO_USER_ID,
        shares: { create: shares },
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
