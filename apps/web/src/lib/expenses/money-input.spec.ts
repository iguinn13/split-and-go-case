import { describe, expect, it } from 'vitest';
import { CURRENCIES } from '@/lib/money/currencies';
import { formatMoney } from '@/lib/money/format-money';
import { buildExpensePayloadSchema } from './schemas';
import {
  displayRate,
  formatBasisPoints,
  MAX_AMOUNT_MINOR,
  amountInputText,
  minorUnitsOf,
  parseAmount,
  parseAmountInput,
  parsePercentInput,
  type AmountParse,
  sanitizeRateInput,
  toApiRate,
} from './money-input';

/** Types the text one character at a time, as the field does, and returns every state. */
function typeKeyByKey(text: string, units: number): AmountParse[] {
  // The field keeps the raw text, so each keystroke just appends to it.
  return [...text].map((_, i) => parseAmount(text.slice(0, i + 1), units));
}

const minorOf = (text: string, units: number) => parseAmountInput(text, units);
const errorOf = (text: string, units: number) => parseAmount(text, units).error;

/** Independent reference parser (regex based), only for differential checks. */
function referenceParse(text: string, units: number): bigint | null {
  const t = text.replace(/\s/g, '');
  const grouped = (s: string, sep: string) => new RegExp(`^\\d{1,3}(\\${sep}\\d{3})*$`).test(s);
  let m: RegExpMatchArray | null;
  if (/^\d+$/.test(t)) return BigInt(t + '0'.repeat(units));
  if (units === 0) {
    return /^\d{1,3}([.,]\d{3})+$/.test(t) ? BigInt(t.replace(/[.,]/g, '')) : null;
  }
  // 1.234,56 / 1,234.56 / 1.234.567,89 (thousands + one decimal separator of the other kind)
  for (const [th, dec] of [
    ['.', ','],
    [',', '.'],
  ] as const) {
    m = t.match(new RegExp(`^(\\d+(?:\\${th}\\d{3})*)\\${dec}(\\d*)$`));
    if (
      m &&
      (m[1] as string).includes(th) &&
      grouped(m[1] as string, th) &&
      (m[2] as string).length <= units
    ) {
      return BigInt((m[1] as string).split(th).join('') + (m[2] as string).padEnd(units, '0'));
    }
  }
  // single separator
  m = t.match(/^(\d*)[.,](\d*)$/);
  if (m) {
    const [, int = '', frac = ''] = m;
    if (frac.length <= units) return BigInt((int || '0') + frac.padEnd(units, '0'));
    if (frac.length === 3 && /^[1-9]\d{0,2}$/.test(int))
      return BigInt(int + frac + '0'.repeat(units));
    return null;
  }
  // equal separators = thousands
  m = t.match(/^\d{1,3}(?:([.,])\d{3})+$/);
  if (m && new Set(t.match(/[.,]/g)).size === 1) {
    return BigInt(t.replace(/[.,]/g, '') + '0'.repeat(units));
  }
  return null;
}

describe('amount input: exact cases (paste and typing)', () => {
  const brl: [string, bigint][] = [
    ['1.234', 123400n],
    ['1,234', 123400n],
    ['1.234,56', 123456n],
    ['1,234.56', 123456n],
    ['1.000', 100000n],
    ['25.000', 2500000n],
    ['999.999', 99999900n],
    ['1.234.567,89', 123456789n],
    ['1,234,567.89', 123456789n],
    ['1.234.567', 123456700n],
    ['1,5', 150n],
    ['1.5', 150n],
    ['1.23', 123n],
    ['0,01', 1n],
    [',5', 50n],
    ['5,', 500n],
    ['007', 700n],
    ['00,50', 50n],
    ['0', 0n],
    ['100', 10000n],
    ['  1 234,56 ', 123456n],
    ['R$ 1.234,56', 123456n],
    ['R$ 1.234,56', 123456n],
    ['US$ 10,01', 1001n],
    ['BRL 5', 500n],
    ['900719925474,99', 90071992547499n],
  ];
  it.each(brl)('pastes %s in a 2-decimal currency', (text, expected) => {
    expect(minorOf(text, 2)).toBe(expected);
  });

  it.each(brl)('typing %s key by key ends at the same value as pasting it', (text, expected) => {
    const states = typeKeyByKey(text, 2);
    const last = states[states.length - 1];
    expect(last).toEqual({ ok: true, minor: expected, error: null });
  });

  it('typing 1.234,56 key by key never reads a thousands mark as decimal', () => {
    const states = typeKeyByKey('1.234,56', 2).map((s) => (s.ok ? s.minor : s.error));
    expect(states).toEqual([
      100n, // 1
      100n, // 1.   (trailing decimal mark)
      120n, // 1.2
      123n, // 1.23
      123400n, // 1.234 (thousands)
      123400n, // 1.234,
      123450n, // 1.234,5
      123456n, // 1.234,56
    ]);
  });

  it('typing 1,234.56 key by key ends at R$ 1.234,56', () => {
    const states = typeKeyByKey('1,234.56', 2);
    expect(states.at(-1)).toMatchObject({ ok: true, minor: 123456n });
    expect(states.at(-4)).toMatchObject({ ok: true, minor: 123400n }); // 1,234
  });

  it('does not reinterpret already formatted text', () => {
    // Re-reading the canonical text of any parsed value gives the same value.
    for (const text of ['1.234', '1.234,56', '25.000', '1,5', '0,01']) {
      const minor = minorOf(text, 2) as bigint;
      expect(minorOf(amountInputText(minor, 2), 2)).toBe(minor);
      expect(minorOf(amountInputText(minor, 2).replace(',', '.'), 2)).toBe(minor);
    }
  });

  const rejected: [string, string][] = [
    ['0,001', 'no máximo 2 casas'],
    ['0.001', 'no máximo 2 casas'],
    ['1,2345', 'no máximo 2 casas'],
    ['12,3456', 'no máximo 2 casas'],
    ['1234,567', 'no máximo 2 casas'],
    ['1.234,567', 'no máximo 2 casas'],
    ['12,345,67', 'ambíguo'],
    ['1.2.3', 'ambíguo'],
    ['1,2,3', 'ambíguo'],
    ['1.234,56,7', 'ambíguo'],
    ['1.234,567,89', 'ambíguo'],
    ['1,234.567.89', 'ambíguo'],
    ['1,234.56.7', 'ambíguo'],
    ['.,5', 'ambíguo'],
    ['-5', 'negativo'],
    ['-1.234,56', 'negativo'],
    ['abc', 'apenas números'],
    ['abc1x2', 'apenas números'],
    ['1e3', 'apenas números'],
    ['1+2', 'apenas números'],
    ['1234567890123456', 'grande demais'],
    ['9'.repeat(5000), 'grande demais'],
  ];
  it.each(rejected)(
    'rejects %s with a visible message instead of dropping digits',
    (text, part) => {
      const result = parseAmount(text.length > 40 ? text : text, 2);
      expect(result.ok).toBe(false);
      expect(result.error).toContain(part);
      expect(minorOf(text, 2)).toBeNull();
    },
  );

  it('treats empty, blank and lone separators as nothing typed yet or invalid', () => {
    expect(parseAmount('', 2)).toEqual({ ok: false, error: null });
    expect(parseAmount('   ', 2)).toEqual({ ok: false, error: null });
    expect(parseAmount('R$', 2)).toEqual({ ok: false, error: null });
    expect(minorOf(',', 2)).toBe(0n);
  });

  it('keeps integer arithmetic exact for very long valid input', () => {
    expect(minorOf('9'.repeat(13), 2)).toBe(BigInt('9'.repeat(13) + '00'));
  });
});

describe('amount input: currencies without decimals (JPY/KRW)', () => {
  it.each([
    ['1.234', 1234n],
    ['1,234', 1234n],
    ['25.000', 25000n],
    ['1.234.567', 1234567n],
    ['1,234.567', 1234567n],
    ['5000', 5000n],
    ['5.000', 5000n],
    ['007', 7n],
    ['JP¥ 5.000', 5000n],
    ['₩ 1.500', 1500n],
  ])('reads %s as %s', (text, expected) => {
    expect(minorOf(text, 0)).toBe(expected);
    expect(typeKeyByKey(text, 0).at(-1)).toMatchObject({ ok: true, minor: expected });
  });

  it.each(['1,5', '1.5', '1.23', '12,34', '1.2345', '5,', ',5', '1.2.3', '1.234,5', '-1'])(
    'rejects %s (no decimals) instead of turning it into another amount',
    (text) => {
      expect(minorOf(text, 0)).toBeNull();
      expect(errorOf(text, 0)).toEqual(expect.any(String));
    },
  );
  it('explains the no-decimals rule', () => {
    expect(errorOf('1,5', 0)).toContain('não tem casas decimais');
  });
});

describe('amount input: 3-decimal currencies', () => {
  it('reads a separator followed by up to 3 digits as decimal', () => {
    expect(minorOf('1,234', 3)).toBe(1234n);
    expect(minorOf('1.234,567', 3)).toBe(1234567n);
    expect(minorOf('1,5', 3)).toBe(1500n);
    expect(errorOf('1,2345', 3)).toContain('no máximo 3 casas');
  });
});

describe('amount input: typing equals pasting, differential and generated checks', () => {
  // Deterministic LCG: the same cases on every run.
  let seed = 123456789;
  const next = (max: number) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed % max;
  };

  const alphabet = ['0', '1', '2', '5', '9', '.', ',', ' ', 'a', '-'];
  const randomText = () =>
    Array.from({ length: 1 + next(10) }, () => alphabet[next(alphabet.length)]).join('');

  it('agrees with the reference parser on 20000 generated texts', () => {
    for (let i = 0; i < 20000; i++) {
      const text = randomText();
      for (const units of [0, 2]) {
        const expected = /[a-z-]/.test(text) ? null : referenceParse(text, units);
        // Blank/only-whitespace text is "nothing typed" in both.
        if (text.trim() === '') continue;
        expect(minorOf(text, units), `${JSON.stringify(text)} units=${units}`).toBe(expected);
      }
    }
  });

  it('is a pure function: the typed state equals a fresh paste of the same prefix', () => {
    for (let i = 0; i < 2000; i++) {
      const text = randomText();
      const typed = typeKeyByKey(text, 2);
      typed.forEach((state, index) => {
        expect(state).toEqual(parseAmount(text.slice(0, index + 1), 2));
      });
    }
  });

  it('never invents or drops digits: a valid result keeps every digit typed', () => {
    for (let i = 0; i < 5000; i++) {
      const text = randomText();
      const result = parseAmount(text, 2);
      if (!result.ok) continue;
      const typedDigits = text.replace(/\D/g, '').replace(/^0+/, '');
      const minorDigits = result.minor.toString().replace(/^0+/, '');
      // Minor units only add zeros to the right when decimals are missing.
      expect(minorDigits.startsWith(typedDigits)).toBe(true);
    }
  });

  it('round-trips amounts formatted by the app, typed or pasted back', () => {
    for (const currency of Object.keys(CURRENCIES)) {
      const units = minorUnitsOf(currency);
      for (let i = 0; i < 1500; i++) {
        const digits = 1 + next(10);
        let minor = BigInt(1 + next(9));
        for (let d = 1; d < digits; d++) minor = minor * 10n + BigInt(next(10));
        if (minor > MAX_AMOUNT_MINOR) minor = minor % MAX_AMOUNT_MINOR || 1n;
        const formatted = formatMoney(minor, currency); // e.g. "R$ 1.234,56", "JP¥ 5.000"
        const plain = formatted.replace(/^[^\d]*/, '');
        const variants = [
          formatted,
          plain,
          amountInputText(minor, units),
          units > 0 ? plain.replace(/\./g, '_').replace(',', '.').replace(/_/g, ',') : plain,
        ];
        for (const variant of variants) {
          expect(minorOf(variant, units), `${currency} ${variant}`).toBe(minor);
          expect(typeKeyByKey(variant, units).at(-1), `${currency} ${variant}`).toMatchObject({
            ok: true,
            minor,
          });
        }
      }
    }
  });
});

describe('amount input: limits', () => {
  const base = {
    description: 'Jantar',
    paidByMemberId: '11111111-1111-4111-8111-111111111111',
    occurredOn: '2026-07-10',
    split: { type: 'EQUAL' as const, participantIds: ['11111111-1111-4111-8111-111111111111'] },
  };
  const check = (originalAmountMinor: number) =>
    buildExpensePayloadSchema('BRL').safeParse({ ...base, currency: 'BRL', originalAmountMinor });

  it('accepts exactly 1e9 minor units in the same currency and rejects 1e9 + 1', () => {
    expect(minorOf('10.000.000,00', 2)).toBe(MAX_AMOUNT_MINOR);
    expect(check(1_000_000_000).success).toBe(true);
    const over = check(1_000_000_001);
    expect(over.success).toBe(false);
    expect(JSON.stringify(over.error?.issues)).toContain('no máximo 1.000.000.000');
    expect(minorOf('10.000.000,01', 2)).toBe(MAX_AMOUNT_MINOR + 1n);
    expect(check(0).success).toBe(false);
    expect(check(1).success).toBe(true);
  });
});

describe('percentages', () => {
  it('parses percentages into basis points', () => {
    expect(parsePercentInput('33,33')).toBe(3333n);
    expect(parsePercentInput('50')).toBe(5000n);
    expect(formatBasisPoints(5000n)).toBe('50%');
    expect(formatBasisPoints(3333n)).toBe('33,33%');
    expect(formatBasisPoints(5n)).toBe('0,05%');
  });
});

describe('exchange rate text', () => {
  it('normalises to the API format', () => {
    expect(toApiRate('5,4325')).toBe('5.4325');
    expect(toApiRate('5.4325')).toBe('5.4325');
    expect(toApiRate('0')).toBeNull();
    expect(toApiRate('0,00')).toBeNull();
    expect(toApiRate('')).toBeNull();
    expect(toApiRate('5,')).toBeNull();
    expect(toApiRate('1e3')).toBeNull();
    expect(toApiRate('1,123456789')).toBeNull();
  });

  it('sanitises typing and trims suggestions', () => {
    expect(sanitizeRateInput('5.43259999999')).toBe('5,43259999');
    expect(sanitizeRateInput('-5e3')).toBe('53');
    expect(displayRate('5.43250000')).toBe('5,4325');
    expect(displayRate('1')).toBe('1');
    expect(displayRate('157.00000000')).toBe('157');
  });
});
