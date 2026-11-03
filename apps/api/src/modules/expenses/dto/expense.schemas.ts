import { z } from 'zod';
import { MAX_AMOUNT_MINOR } from '../../../common/money/convert-amount.js';
import { currencySchema } from '../../../common/money/currencies.js';

const memberId = z.uuid();
const amountMinor = z.number().int().min(1).max(MAX_AMOUNT_MINOR);

const equalSplit = z
    .object({
        type: z.literal('EQUAL'),
        participantIds: z.array(memberId).max(100),
    })
    .strict();

const percentageSplit = z
    .object({
        type: z.literal('PERCENTAGE'),
        shares: z
            .array(
                z.object({ memberId, basisPoints: z.number().int().min(1).max(10_000) }).strict(),
            )
            .max(100),
    })
    .strict();

const fixedSplit = z
    .object({
        type: z.literal('FIXED'),
        shares: z.array(z.object({ memberId, originalAmountMinor: amountMinor }).strict()).max(100),
    })
    .strict();

const isoDate = z.string().refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}, 'Date must be a valid YYYY-MM-DD');

export const createExpenseSchema = z
    .object({
        description: z.string().trim().min(1).max(120),
        currency: currencySchema.optional(),
        originalAmountMinor: amountMinor,
        // Format and range are checked by the calculators so that violations return
        // EXCHANGE_RATE_INVALID (AC-CUR-05 to AC-CUR-07) instead of a generic validation error.
        exchangeRate: z.string().max(40).optional(),
        paidByMemberId: memberId,
        occurredOn: isoDate,
        split: z.discriminatedUnion('type', [equalSplit, percentageSplit, fixedSplit]),
    })
    .strict();

export const groupParamsSchema = z.object({ groupId: z.uuid() });
export const expenseParamsSchema = z.object({ groupId: z.uuid(), expenseId: z.uuid() });

export const listExpensesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

export interface ExpenseShareView {
    memberId: string;
    originalAmountMinor: number;
    amountMinor: number;
    basisPoints: number | null;
}

export interface ExpenseView {
    id: string;
    groupId: string;
    description: string;
    currency: string;
    originalAmountMinor: number;
    exchangeRate: string;
    amountMinor: number;
    paidByMemberId: string;
    splitType: 'EQUAL' | 'PERCENTAGE' | 'FIXED';
    occurredOn: string;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
    shares: ExpenseShareView[];
}

export interface Page<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
}
