import { z } from 'zod';
import type { StatementLine } from '../calculators/balance.calculator.js';

export const groupParamsSchema = z.object({ groupId: z.uuid() });
export const memberParamsSchema = z.object({ groupId: z.uuid(), memberId: z.uuid() });

export interface BalancesView {
    currency: string;
    balances: {
        memberId: string;
        name: string;
        paidMinor: number;
        owedMinor: number;
        netMinor: number;
    }[];
}

export interface StatementView {
    currency: string;
    member: { id: string; name: string };
    totals: { paidMinor: number; owedMinor: number; netMinor: number };
    lines: StatementLine[];
}
