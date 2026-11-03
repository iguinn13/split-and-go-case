/**
 * Independent reference calculations for the e2e expectations. Deliberately NOT importing the
 * app code: everything is plain BigInt arithmetic written from the specs (03, 04, 06).
 */

export interface Weighted {
    id: string;
    weight: bigint;
}

/** RN-EXP-06: largest remainder; ties broken by ascending member id. */
export function allocate(total: bigint, parts: Weighted[]): Map<string, bigint> {
    const sum = parts.reduce((acc, p) => acc + p.weight, 0n);
    const rows = parts.map((p) => ({
        id: p.id,
        base: (total * p.weight) / sum,
        remainder: (total * p.weight) % sum,
    }));
    let left = total - rows.reduce((acc, r) => acc + r.base, 0n);
    const byRemainder = [...rows].sort((a, b) =>
        a.remainder === b.remainder ? (a.id < b.id ? -1 : 1) : a.remainder > b.remainder ? -1 : 1,
    );

    for (const row of byRemainder) {
        if (left === 0n) break;

        row.base += 1n;
        left -= 1n;
    }

    return new Map(rows.map((r) => [r.id, r.base]));
}

/** RN-CUR-05 for two currencies with the same number of decimals; rate is decimal text. */
export function convertSameDecimals(originalMinor: bigint, rate: string): bigint {
    const [integer = '0', fraction = ''] = rate.split('.');
    const scaled = BigInt(integer + fraction.padEnd(8, '0'));

    return (originalMinor * scaled + 50_000_000n) / 100_000_000n;
}

export interface Transfer {
    from: string;
    to: string;
    amount: bigint;
}

/**
 * Minimal settlement for at most 3 members: with 3 or fewer non-zero balances that sum to zero,
 * one side always has a single member, so each member of the other side pays/receives exactly
 * their balance (the result is unique, regardless of ids).
 */
export function settle(net: Map<string, bigint>): Transfer[] {
    const creditors = [...net].filter(([, v]) => v > 0n);
    const debtors = [...net].filter(([, v]) => v < 0n);

    if (creditors.length > 1 && debtors.length > 1) throw new Error('Scenario too complex');

    if (creditors.length === 1) {
        const [to] = creditors[0]!;

        return debtors.map(([from, v]) => ({ from, to, amount: -v }));
    }

    const [from] = debtors[0] ?? [''];

    return creditors.map(([to, v]) => ({ from, to, amount: v }));
}

/** pt-BR currency text as a regex source ("R$ 1.234,56": any whitespace, incl. NBSP). */
export function moneyPattern(minor: bigint, symbol = 'R\\$'): string {
    const negative = minor < 0n;
    const digits = (negative ? -minor : minor).toString().padStart(3, '0');
    const integer = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '\\.');

    return `${negative ? '-' : ''}${symbol}\\s*${integer},${digits.slice(-2)}`;
}
