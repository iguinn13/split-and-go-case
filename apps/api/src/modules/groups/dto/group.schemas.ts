import { z } from 'zod';
import { currencySchema } from '../../../common/money/currencies.js';

const optionalEmail = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(254))
    .nullish()
    .transform((value) => value ?? null);

export const memberInputSchema = z.object({
    name: z.string().trim().min(1).max(60),
    email: optionalEmail,
});

const description = z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((value) => (value ? value : null));

export const createGroupSchema = z
    .object({
        name: z.string().trim().min(2).max(80),
        baseCurrency: currencySchema.default('BRL'),
        description,
        members: z.array(memberInputSchema).max(50).default([]),
    })
    .strict();

// `baseCurrency` is immutable (RN-GRP-01): strict() rejects it with a validation error.
export const updateGroupSchema = z
    .object({
        name: z.string().trim().min(2).max(80).optional(),
        description: description.optional(),
    })
    .strict()
    .refine((value) => value.name !== undefined || value.description !== undefined, {
        message: 'At least one field must be provided',
    });

export const groupIdParamsSchema = z.object({ groupId: z.uuid() });
export const memberParamsSchema = z.object({ groupId: z.uuid(), memberId: z.uuid() });

export type MemberInput = z.infer<typeof memberInputSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export interface MemberView {
    id: string;
    name: string;
    email: string | null;
    userId: string | null;
}

export interface GroupView {
    id: string;
    name: string;
    description: string | null;
    baseCurrency: string;
    status: 'OPEN' | 'CLOSED';
    ownerId: string;
    closedAt: Date | null;
    createdAt: Date;
    members: MemberView[];
}

export interface GroupSummaryView {
    id: string;
    name: string;
    status: 'OPEN' | 'CLOSED';
    baseCurrency: string;
    memberCount: number;
    createdAt: Date;
}
