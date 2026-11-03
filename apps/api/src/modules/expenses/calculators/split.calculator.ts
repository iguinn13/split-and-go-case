import { AppError } from '../../../common/errors/app-error.js';
import {
    type AllocationWeight,
    allocateProportionally,
} from '../../../common/money/allocate-proportionally.js';
import {
    assertAmountInRange,
    convertAmount,
    parseExchangeRate,
} from '../../../common/money/convert-amount.js';
import type { CurrencyCode } from '../../../common/money/currencies.js';

export const TOTAL_BASIS_POINTS = 10_000;
const IDENTITY_RATE = 10n ** 8n;

export type SplitInput =
    | { type: 'EQUAL'; participantIds: readonly string[] }
    | { type: 'PERCENTAGE'; shares: readonly { memberId: string; basisPoints: number }[] }
    | { type: 'FIXED'; shares: readonly { memberId: string; originalAmountMinor: number }[] };

export interface CalculateSharesInput {
    currency: CurrencyCode;
    baseCurrency: CurrencyCode;
    originalAmountMinor: number;
    /** Required when currency differs from baseCurrency; must be 1 otherwise. */
    exchangeRate?: string;
    split: SplitInput;
}

export interface ExpenseShare {
    memberId: string;
    /** Share in the expense currency. */
    originalAmountMinor: number;
    /** Share in the group's base currency. */
    amountMinor: number;
}

export interface CalculatedSplit {
    exchangeRate: string;
    /** Converted total, in the base currency. */
    amountMinor: number;
    shares: ExpenseShare[];
}

function invalid(message: string): AppError {
    return new AppError('VALIDATION_ERROR', 422, message);
}

function toWeights(split: SplitInput, originalAmountMinor: number): AllocationWeight[] {
    if (split.type === 'EQUAL') {
        return split.participantIds.map((memberId) => ({ memberId, weight: 1 }));
    }

    if (split.type === 'PERCENTAGE') {
        if (split.shares.some((s) => !Number.isSafeInteger(s.basisPoints) || s.basisPoints < 1)) {
            throw invalid('Basis points must be integers greater than zero');
        }

        const sum = split.shares.reduce((acc, s) => acc + s.basisPoints, 0);

        if (sum !== TOTAL_BASIS_POINTS) {
            throw new AppError(
                'SPLIT_PERCENTAGE_SUM_INVALID',
                422,
                `Percentages must sum to ${TOTAL_BASIS_POINTS} basis points`,
            );
        }

        return split.shares.map((s) => ({ memberId: s.memberId, weight: s.basisPoints }));
    }

    if (
        split.shares.some(
            (s) => !Number.isSafeInteger(s.originalAmountMinor) || s.originalAmountMinor < 1,
        )
    ) {
        throw invalid('Fixed amounts must be integers greater than zero');
    }

    const sum = split.shares.reduce((acc, s) => acc + s.originalAmountMinor, 0);

    if (sum !== originalAmountMinor) {
        throw new AppError(
            'SPLIT_FIXED_SUM_INVALID',
            422,
            'Fixed amounts must sum to the expense amount',
        );
    }

    return split.shares.map((s) => ({ memberId: s.memberId, weight: s.originalAmountMinor }));
}

/**
 * Pure split calculation (RN-EXP-06 to RN-EXP-09a). The total is converted once, then both the
 * original and the converted totals are allocated with the same weights, so both sums are exact.
 */
export function calculateShares(input: CalculateSharesInput): CalculatedSplit {
    const { currency, baseCurrency, originalAmountMinor, split } = input;
    const sameCurrency = currency === baseCurrency;
    const exchangeRate = input.exchangeRate ?? (sameCurrency ? '1' : undefined);

    if (exchangeRate === undefined) {
        throw new AppError('EXCHANGE_RATE_INVALID', 422, 'Exchange rate is required');
    }

    if (sameCurrency && parseExchangeRate(exchangeRate) !== IDENTITY_RATE) {
        throw new AppError(
            'EXCHANGE_RATE_INVALID',
            422,
            'Exchange rate must be 1 when the currency is the group base currency',
        );
    }

    assertAmountInRange(originalAmountMinor);

    const memberIds =
        split.type === 'EQUAL' ? split.participantIds : split.shares.map((s) => s.memberId);

    if (memberIds.length === 0 || new Set(memberIds).size !== memberIds.length) {
        throw new AppError(
            'INVALID_SPLIT_PARTICIPANTS',
            422,
            'Split needs at least one participant and no duplicates',
        );
    }

    const weights = toWeights(split, originalAmountMinor);
    const amountMinor = convertAmount(originalAmountMinor, exchangeRate, currency, baseCurrency);

    const original = allocateProportionally(originalAmountMinor, weights);
    const converted = allocateProportionally(amountMinor, weights);

    return {
        exchangeRate,
        amountMinor,
        shares: original.map((part, index) => ({
            memberId: part.memberId,
            originalAmountMinor: part.amountMinor,
            amountMinor: converted[index]!.amountMinor,
        })),
    };
}
