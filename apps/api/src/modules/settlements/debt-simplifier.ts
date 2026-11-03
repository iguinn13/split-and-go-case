/**
 * Pure debt simplification (RN-BAL-04 to RN-BAL-09, ADR 0002).
 * No I/O, no framework imports. All amounts are integers in the minor unit.
 *
 * - Up to EXACT_SOLVER_MAX_PARTICIPANTS non-zero balances: exact bitmask DP that
 *   finds the largest number `g` of disjoint zero-sum subgroups (n - g transfers).
 * - Above that: greedy (largest creditor x largest debtor), at most n - 1 transfers.
 *
 * Determinism: participants are sorted by memberId and every tie is broken by
 * ascending memberId, so the plan does not depend on the input order.
 */

/** Largest number of non-zero balances solved exactly. Single place to tune it. */
export const EXACT_SOLVER_MAX_PARTICIPANTS = 16;

export interface DebtBalance {
    memberId: string;
    /** Net balance: positive = is owed money, negative = owes money. */
    netMinor: number;
}

export interface Transfer {
    from: string;
    to: string;
    amountMinor: number;
}

export class DebtSimplifierInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DebtSimplifierInputError';
    }
}

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Validates the input and returns non-zero balances sorted by memberId. */
function normalize(balances: readonly DebtBalance[]): DebtBalance[] {
    const seen = new Set<string>();
    let total = 0;
    let totalAbs = 0;

    for (const { memberId, netMinor } of balances) {
        if (!Number.isSafeInteger(netMinor)) {
            throw new DebtSimplifierInputError(`Balance of ${memberId} must be a safe integer`);
        }

        if (seen.has(memberId)) {
            throw new DebtSimplifierInputError(`Duplicate member ${memberId}`);
        }

        seen.add(memberId);
        total += netMinor;
        totalAbs += Math.abs(netMinor);

        // Sums are accumulated in Number: beyond this bound they could silently lose precision.
        if (totalAbs > Number.MAX_SAFE_INTEGER) {
            throw new DebtSimplifierInputError(
                'Sum of absolute balances exceeds the safe integer range',
            );
        }
    }

    if (total !== 0) {
        throw new DebtSimplifierInputError(`Balances must sum to zero, got ${total}`);
    }

    return balances
        .filter((b) => b.netMinor !== 0)
        .map((b) => ({ memberId: b.memberId, netMinor: b.netMinor }))
        .sort((a, b) => compareIds(a.memberId, b.memberId));
}

/**
 * Settles one zero-sum group greedily. `members` must be sorted by memberId.
 * Ties on magnitude pick the lowest memberId, thanks to the strict comparison
 * over a sorted list.
 */
function settleGreedy(members: readonly DebtBalance[]): Transfer[] {
    const remaining = members.map((m) => m.netMinor);
    const transfers: Transfer[] = [];

    for (;;) {
        let creditor = -1;
        let debtor = -1;

        for (let i = 0; i < remaining.length; i++) {
            const value = remaining[i] as number;

            if (value > 0 && (creditor < 0 || value > (remaining[creditor] as number)))
                creditor = i;

            if (value < 0 && (debtor < 0 || value < (remaining[debtor] as number))) debtor = i;
        }

        if (creditor < 0 || debtor < 0) return transfers;

        const amountMinor = Math.min(remaining[creditor] as number, -(remaining[debtor] as number));

        transfers.push({
            from: (members[debtor] as DebtBalance).memberId,
            to: (members[creditor] as DebtBalance).memberId,
            amountMinor,
        });
        remaining[creditor] = (remaining[creditor] as number) - amountMinor;
        remaining[debtor] = (remaining[debtor] as number) + amountMinor;
    }
}

/** Splits sorted members into the maximum number of disjoint zero-sum subgroups. */
function partitionZeroSum(members: readonly DebtBalance[]): DebtBalance[][] {
    const n = members.length;
    const size = 1 << n;
    const full = size - 1;
    const sums = new Float64Array(size);
    const dp = new Uint8Array(size);

    for (let mask = 1; mask < size; mask++) {
        const low = 31 - Math.clz32(mask & -mask);

        sums[mask] = (sums[mask & (mask - 1)] as number) + (members[low] as DebtBalance).netMinor;
        const bonus = sums[mask] === 0 ? 1 : 0;
        let best = 0;

        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                const candidate = dp[mask ^ (1 << i)] as number;

                if (candidate > best) best = candidate;
            }
        }

        dp[mask] = best + bonus;
    }

    // Rebuild a removal order: at each step remove the lowest index that keeps dp optimal.
    const removalOrder: number[] = [];
    let mask = full;

    while (mask !== 0) {
        const target = (dp[mask] as number) - (sums[mask] === 0 ? 1 : 0);
        let chosen = -1;

        for (let i = 0; i < n; i++) {
            if (mask & (1 << i) && dp[mask ^ (1 << i)] === target) {
                chosen = i;
                break;
            }
        }

        removalOrder.push(chosen);
        mask ^= 1 << chosen;
    }

    // Cut the order wherever the running sum returns to zero.
    const groups: DebtBalance[][] = [];
    let current: DebtBalance[] = [];
    let running = 0;

    for (const index of removalOrder) {
        const member = members[index] as DebtBalance;

        current.push(member);
        running += member.netMinor;

        if (running === 0) {
            groups.push(current.sort((a, b) => compareIds(a.memberId, b.memberId)));
            current = [];
        }
    }

    return groups;
}

const sortTransfers = (transfers: Transfer[]): Transfer[] =>
    // The (from, to) pair is unique in a plan (RN-BAL-09), so no further tie-break is needed.
    transfers.sort((a, b) => compareIds(a.from, b.from) || compareIds(a.to, b.to));

/** Greedy plan for any size (at most n - 1 transfers). Exported to compare with the exact path. */
export function simplifyDebtsGreedy(balances: readonly DebtBalance[]): Transfer[] {
    return sortTransfers(settleGreedy(normalize(balances)));
}

/**
 * Minimal transfer plan for the given net balances (which must sum to zero).
 * Exact up to EXACT_SOLVER_MAX_PARTICIPANTS non-zero balances, greedy above it.
 */
export function simplifyDebts(balances: readonly DebtBalance[]): Transfer[] {
    const members = normalize(balances);

    if (members.length > EXACT_SOLVER_MAX_PARTICIPANTS) {
        return sortTransfers(settleGreedy(members));
    }

    return sortTransfers(partitionZeroSum(members).flatMap((group) => settleGreedy(group)));
}
