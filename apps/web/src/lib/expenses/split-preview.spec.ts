import { describe, expect, it } from 'vitest';
import {
  allocateProportionally,
  convertAmount,
  previewSplit,
  type SplitDraft,
} from './split-preview';

const ids = ['a', 'b', 'c'];
const equal = (memberIds: string[]): SplitDraft => ({ type: 'EQUAL', memberIds });
const nums = (shares: { amountMinor: bigint }[]) => shares.map((s) => Number(s.amountMinor));

function ok(result: ReturnType<typeof previewSplit>) {
  if (!result.ok) throw new Error(result.problems.join('|'));
  return result;
}

describe('allocateProportionally', () => {
  it('breaks ties by ascending memberId regardless of input order', () => {
    const result = allocateProportionally(100n, [
      { memberId: 'c', weight: 1n },
      { memberId: 'a', weight: 1n },
      { memberId: 'b', weight: 1n },
    ]);
    expect(result.map((r) => [r.memberId, Number(r.amountMinor)])).toEqual([
      ['c', 33],
      ['a', 34],
      ['b', 33],
    ]);
  });

  it('gives leftover units to the largest remainder', () => {
    expect(
      allocateProportionally(10n, [
        { memberId: 'a', weight: 1n },
        { memberId: 'b', weight: 2n },
      ]).map((r) => Number(r.amountMinor)),
    ).toEqual([3, 7]);
  });
});

describe('convertAmount', () => {
  it('matches the spec examples', () => {
    expect(convertAmount(10000n, '5.4325', 'USD', 'BRL')).toEqual({
      ok: true,
      amountMinor: 54325n,
    });
    expect(convertAmount(5000n, '0.0345', 'JPY', 'BRL')).toEqual({ ok: true, amountMinor: 17250n });
    expect(convertAmount(3333n, '6.0712', 'EUR', 'BRL')).toEqual({ ok: true, amountMinor: 20235n });
    expect(convertAmount(10000n, '0.1841', 'BRL', 'USD')).toEqual({ ok: true, amountMinor: 1841n });
  });

  it('rounds half up (US$ 10.00 at 157.25 -> JPY 1573)', () => {
    expect(convertAmount(1000n, '157.25', 'USD', 'JPY')).toEqual({ ok: true, amountMinor: 1573n });
  });

  it('flags invalid rates and out-of-range results', () => {
    expect(convertAmount(100n, '0', 'USD', 'BRL')).toEqual({ ok: false, error: 'RATE_INVALID' });
    expect(convertAmount(100n, '1e3', 'USD', 'BRL')).toEqual({ ok: false, error: 'RATE_INVALID' });
    expect(convertAmount(1n, '0.00000001', 'USD', 'BRL')).toEqual({
      ok: false,
      error: 'OUT_OF_RANGE',
    });
    expect(convertAmount(1_000_000_000n, '2', 'USD', 'BRL')).toEqual({
      ok: false,
      error: 'OUT_OF_RANGE',
    });
  });

  it('accepts a comma as decimal separator', () => {
    expect(convertAmount(10000n, '5,4325', 'USD', 'BRL')).toEqual({
      ok: true,
      amountMinor: 54325n,
    });
  });
});

describe('previewSplit (same currency)', () => {
  const base = { currency: 'BRL', baseCurrency: 'BRL', exchangeRate: '' };

  it('splits 100/4 exactly', () => {
    const r = ok(
      previewSplit({ ...base, originalAmountMinor: 10000n, split: equal(['a', 'b', 'c', 'd']) }),
    );
    expect(nums(r.shares)).toEqual([2500, 2500, 2500, 2500]);
  });

  it('splits 100/3 giving the cent to the first memberId', () => {
    const r = ok(previewSplit({ ...base, originalAmountMinor: 10000n, split: equal(ids) }));
    expect(nums(r.shares)).toEqual([3334, 3333, 3333]);
  });

  it('splits 50/30/20 percent', () => {
    const r = ok(
      previewSplit({
        ...base,
        originalAmountMinor: 10000n,
        split: {
          type: 'PERCENTAGE',
          shares: [
            { memberId: 'a', basisPoints: 5000n },
            { memberId: 'b', basisPoints: 3000n },
            { memberId: 'c', basisPoints: 2000n },
          ],
        },
      }),
    );
    expect(nums(r.shares)).toEqual([5000, 3000, 2000]);
  });

  it('splits 10.01 at 50/50 as 501/500', () => {
    const r = ok(
      previewSplit({
        ...base,
        originalAmountMinor: 1001n,
        split: {
          type: 'PERCENTAGE',
          shares: [
            { memberId: 'a', basisPoints: 5000n },
            { memberId: 'b', basisPoints: 5000n },
          ],
        },
      }),
    );
    expect(nums(r.shares)).toEqual([501, 500]);
  });

  it('keeps fixed amounts as typed', () => {
    const r = ok(
      previewSplit({
        ...base,
        originalAmountMinor: 10000n,
        split: {
          type: 'FIXED',
          shares: [
            { memberId: 'a', amountMinor: 6000n },
            { memberId: 'b', amountMinor: 4000n },
          ],
        },
      }),
    );
    expect(nums(r.shares)).toEqual([6000, 4000]);
  });

  it('reports what is missing or in excess', () => {
    const missing = previewSplit({
      ...base,
      originalAmountMinor: 10000n,
      split: {
        type: 'FIXED',
        shares: [
          { memberId: 'a', amountMinor: 6000n },
          { memberId: 'b', amountMinor: 3000n },
        ],
      },
    });
    expect(missing).toEqual({ ok: false, problems: [expect.stringMatching(/^Faltam R\$.10,00/)] });

    const excess = previewSplit({
      ...base,
      originalAmountMinor: 10000n,
      split: {
        type: 'PERCENTAGE',
        shares: [
          { memberId: 'a', basisPoints: 6000n },
          { memberId: 'b', basisPoints: 5000n },
        ],
      },
    });
    expect(excess).toEqual({ ok: false, problems: ['O rateio excede o total em 10%.'] });
  });

  it('requires an amount and participants', () => {
    expect(previewSplit({ ...base, originalAmountMinor: null, split: equal([]) }).ok).toBe(false);
    expect(previewSplit({ ...base, originalAmountMinor: 0n, split: equal(ids) }).ok).toBe(false);
  });
});

describe('previewSplit (foreign currency)', () => {
  const usd = { currency: 'USD', baseCurrency: 'BRL', exchangeRate: '5,4325' };

  it('US$ 100 / 3 at 5.4325 -> 3334/3333/3333 and 18109/18108/18108', () => {
    const r = ok(previewSplit({ ...usd, originalAmountMinor: 10000n, split: equal(ids) }));
    expect(r.amountMinor).toBe(54325n);
    expect(r.shares.map((s) => Number(s.originalAmountMinor))).toEqual([3334, 3333, 3333]);
    expect(nums(r.shares)).toEqual([18109, 18108, 18108]);
  });

  it('fixed US$ 60/40 -> 32595/21730', () => {
    const r = ok(
      previewSplit({
        ...usd,
        originalAmountMinor: 10000n,
        split: {
          type: 'FIXED',
          shares: [
            { memberId: 'a', amountMinor: 6000n },
            { memberId: 'b', amountMinor: 4000n },
          ],
        },
      }),
    );
    expect(nums(r.shares)).toEqual([32595, 21730]);
  });

  it('JPY 5.000 at 50/50 -> 8625/8625', () => {
    const r = ok(
      previewSplit({
        currency: 'JPY',
        baseCurrency: 'BRL',
        exchangeRate: '0.0345',
        originalAmountMinor: 5000n,
        split: {
          type: 'PERCENTAGE',
          shares: [
            { memberId: 'a', basisPoints: 5000n },
            { memberId: 'b', basisPoints: 5000n },
          ],
        },
      }),
    );
    expect(r.amountMinor).toBe(17250n);
    expect(nums(r.shares)).toEqual([8625, 8625]);
  });

  it('US$ 10.00 into a JPY group -> 1573', () => {
    const r = ok(
      previewSplit({
        currency: 'USD',
        baseCurrency: 'JPY',
        exchangeRate: '157.25',
        originalAmountMinor: 1000n,
        split: equal(['a']),
      }),
    );
    expect(r.amountMinor).toBe(1573n);
  });

  it('asks for a rate when it is missing or invalid', () => {
    for (const exchangeRate of ['', '0', 'abc']) {
      expect(
        previewSplit({ ...usd, exchangeRate, originalAmountMinor: 10000n, split: equal(ids) }),
      ).toEqual({
        ok: false,
        problems: ['Informe uma taxa de câmbio válida.'],
      });
    }
  });
});

describe('previewSplit (converted limits)', () => {
  const run = (originalAmountMinor: bigint, exchangeRate: string) =>
    previewSplit({
      currency: 'USD',
      baseCurrency: 'BRL',
      exchangeRate,
      originalAmountMinor,
      split: equal(['a']),
    });

  it('accepts a converted total of exactly 1.000.000.000', () => {
    expect(ok(run(500_000_000n, '2')).amountMinor).toBe(1_000_000_000n);
  });

  it('rejects a converted total of 1.000.000.001 (666.666.667 x 1,5 rounds half up)', () => {
    expect(convertAmount(666_666_667n, '1.5', 'USD', 'BRL')).toEqual({
      ok: false,
      error: 'OUT_OF_RANGE',
    });
    expect(run(666_666_667n, '1.5')).toEqual({
      ok: false,
      problems: ['O valor convertido deve estar entre 1 e 1.000.000.000.'],
    });
  });
});
