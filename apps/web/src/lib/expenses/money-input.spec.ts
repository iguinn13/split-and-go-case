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
  parsePercent,
  parsePercentInput,
  type AmountParse,
  sanitizeRateInput,
  toApiRate,
} from './money-input';

/** Types the text one character at a time, as the field does, and returns every state. */
function typeKeyByKey(text: string, currency: string): AmountParse[] {
  // The field keeps the raw text, so each keystroke just appends to it.
  return [...text].map((_, i) => read(text.slice(0, i + 1), currency));
}

const read = (text: string, currency: string) =>
  parseAmount(text, minorUnitsOf(currency), currency);
const minorOf = (text: string, currency: string) => {
  const result = read(text, currency);
  return result.ok ? result.minor : null;
};
const errorOf = (text: string, currency: string) => read(text, currency).error;

const SPACES = '[ \\u00a0\\u202f\\u2009]';

/**
 * Independent reference parser (regex based, own marker table), only for differential checks.
 * Written from the rules, not from the implementation.
 */
function referenceParse(text: string, currency: 'BRL' | 'JPY'): bigint | null {
  const units = currency === 'BRL' ? 2 : 0;
  let t = text.trim();
  const marker = currency === 'BRL' ? /^(R\$|[Bb][Rr][Ll])/ : /^(JP¥|[Jj][Pp][Yy])/;
  const anyMarker = /^[^\d.,\s-]+/;
  const lead = anyMarker.exec(t)?.[0];
  if (lead !== undefined) {
    const own = marker.exec(lead);
    if (!own || own[0] !== lead) return null;
    t = t.slice(lead.length).trim();
  }
  if (/[^\d.,\s]/.test(t)) return null;
  if (new RegExp(SPACES).test(t) || /\s/.test(t)) {
    const m = t.match(new RegExp(`^([1-9]\\d{0,2}(?:${SPACES}\\d{3})+)([.,]\\d*)?$`));
    if (!m) return null;
    t = (m[1] as string).replace(/\s/g, '') + (m[2] ?? '');
  }
  if (t === '') return null;
  if (/^\d+$/.test(t)) return BigInt(t + '0'.repeat(units));
  if (units === 0) {
    return /^[1-9]\d{0,2}(?:\.\d{3})+$/.test(t) || /^[1-9]\d{0,2}(?:,\d{3})+$/.test(t)
      ? BigInt(t.replace(/[.,]/g, ''))
      : null;
  }
  // thousands + one decimal separator of the other kind: 1.234,56 / 1,234.56
  for (const [th, dec] of [
    ['.', ','],
    [',', '.'],
  ] as const) {
    const m = t.match(new RegExp(`^(\\d+(?:\\${th}\\d{3})*)\\${dec}(\\d*)$`));
    if (m && (m[1] as string).includes(th)) {
      const head = m[1] as string;
      const frac = m[2] as string;
      if (!new RegExp(`^[1-9]\\d{0,2}(\\${th}\\d{3})+$`).test(head)) return null;
      return frac.length <= units
        ? BigInt(head.split(th).join('') + frac.padEnd(units, '0'))
        : null;
    }
  }
  const single = t.match(/^(\d*)[.,](\d*)$/);
  if (single) {
    const [, int = '', frac = ''] = single;
    if (frac.length <= units) return BigInt((int || '0') + frac.padEnd(units, '0'));
    if (frac.length === 3 && /^[1-9]\d{0,2}$/.test(int)) return BigInt(int + frac + '00');
    return null;
  }
  // several equal separators = thousands
  if (/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(t) || /^[1-9]\d{0,2}(?:,\d{3})+$/.test(t)) {
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
    ['  1.234,56 ', 123456n],
    ['1 234,56', 123456n],
    ['1 234,56', 123456n],
    ['1 234,56', 123456n],
    ['1 234,56', 123456n],
    ['10 000', 1000000n],
    ['1 234 567', 123456700n],
    ['R$ 1.234,56', 123456n],
    ['R$ 1.234,56', 123456n],
    ['R$1.234,56', 123456n],
    ['BRL 5', 500n],
    ['brl 5', 500n],
    ['900719925474,99', 90071992547499n],
  ];
  it.each(brl)('pastes %s in BRL', (text, expected) => {
    expect(minorOf(text, 'BRL')).toBe(expected);
  });

  it.each(brl)('typing %s key by key ends at the same value as pasting it', (text, expected) => {
    expect(typeKeyByKey(text, 'BRL').at(-1)).toMatchObject({ ok: true, minor: expected });
  });

  it('typing 1.234,56 key by key never reads a thousands mark as decimal', () => {
    const states = typeKeyByKey('1.234,56', 'BRL').map((s) => (s.ok ? s.minor : s.error));
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
    const states = typeKeyByKey('1,234.56', 'BRL');
    expect(states.at(-1)).toMatchObject({ ok: true, minor: 123456n });
    expect(states.at(-4)).toMatchObject({ ok: true, minor: 123400n }); // 1,234
  });

  it('flags only the single-separator + 3 digits shape as the thousands hint', () => {
    const hint = (text: string) => {
      const r = read(text, 'BRL');
      return r.ok && r.thousandsHint;
    };
    for (const text of ['1.234', '12.345', '10.000', '1,234', '999.999'])
      expect(hint(text)).toBe(true);
    for (const text of ['1.23', '1,5', '1.234,56', '1.234.567', '1234', '1.2']) {
      expect(hint(text)).toBe(false);
    }
    expect(minorOf('12.345', 'BRL')).toBe(1234500n);
  });

  it('does not reinterpret already formatted text', () => {
    for (const text of ['1.234', '1.234,56', '25.000', '1,5', '0,01']) {
      const minor = minorOf(text, 'BRL') as bigint;
      expect(minorOf(amountInputText(minor, 2), 'BRL')).toBe(minor);
      expect(minorOf(amountInputText(minor, 2).replace(',', '.'), 'BRL')).toBe(minor);
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
    ['0.000.500', 'ambíguo'],
    ['1.234,56,7', 'ambíguo'],
    ['1.234,567,89', 'ambíguo'],
    ['1,234.567.89', 'ambíguo'],
    ['.,5', 'ambíguo'],
    ['-5', 'negativo'],
    ['-1.234,56', 'negativo'],
    ['R$ -5', 'negativo'],
    ['abc', 'apenas números'],
    ['abc1x2', 'apenas números'],
    ['1e3', 'apenas números'],
    ['1+2', 'apenas números'],
    ['1​234', 'apenas números'],
    ['1234567890123456', 'grande demais'],
    ['9'.repeat(5000), 'grande demais'],
    // whitespace inside the number is never deleted
    ['12 50', 'Espaço no meio'],
    ['1 2', 'Espaço no meio'],
    ['1 5', 'Espaço no meio'],
    ['1  234', 'Espaço no meio'],
    ['1 23', 'Espaço no meio'],
    ['1 2345', 'Espaço no meio'],
    ['0 123', 'Espaço no meio'],
    ['1 234 56', 'Espaço no meio'],
    ['1\t234', 'Espaço no meio'],
    ['1\n234', 'Espaço no meio'],
    ['1 234,5 6', 'Espaço no meio'],
    ['1 234.567,89', 'Espaço no meio'],
    // only BRL's own marker is accepted
    ['US$ 10', 'Este campo é em BRL'],
    ['€ 100', 'Este campo é em BRL'],
    ['r$ 10', 'Este campo é em BRL'],
    ['xyz$ 10', 'Este campo é em BRL'],
    ['$ 10', 'Este campo é em BRL'],
    ['USD 10', 'Este campo é em BRL'],
    ['JP¥ 10', 'Este campo é em BRL'],
  ];
  it.each(rejected)('rejects %j with a visible message instead of altering it', (text, part) => {
    const result = read(text, 'BRL');
    expect(result.ok).toBe(false);
    expect(result.error).toContain(part);
    expect(minorOf(text, 'BRL')).toBeNull();
  });

  it('treats empty, blank and marker-only text as nothing typed yet', () => {
    expect(read('', 'BRL')).toEqual({ ok: false, error: null });
    expect(read('   ', 'BRL')).toEqual({ ok: false, error: null });
    expect(read('R$', 'BRL')).toEqual({ ok: false, error: null });
    expect(read('R$ ', 'BRL')).toEqual({ ok: false, error: null });
    expect(minorOf(',', 'BRL')).toBe(0n);
  });

  it('accepts only the selected currency marker, per currency', () => {
    expect(minorOf('US$ 10', 'USD')).toBe(1000n);
    expect(minorOf('usd 10', 'USD')).toBe(1000n);
    expect(minorOf('€ 1.234,56', 'EUR')).toBe(123456n);
    expect(errorOf('R$ 10', 'USD')).toContain('Este campo é em USD');
    expect(errorOf('US$ 10', 'EUR')).toContain('Este campo é em EUR');
  });

  it('keeps integer arithmetic exact for very long valid input', () => {
    expect(minorOf('9'.repeat(13), 'BRL')).toBe(BigInt('9'.repeat(13) + '00'));
  });
});

describe('amount input: currencies without decimals (JPY/KRW)', () => {
  it.each([
    ['1.234', 1234n],
    ['1,234', 1234n],
    ['25.000', 25000n],
    ['1.234.567', 1234567n],
    ['1,234,567', 1234567n],
    ['5000', 5000n],
    ['5.000', 5000n],
    ['007', 7n],
    ['1 234', 1234n],
    ['10 000', 10000n],
    ['JP¥ 5.000', 5000n],
    ['jpy 5.000', 5000n],
  ])('reads %s in JPY as %s', (text, expected) => {
    expect(minorOf(text, 'JPY')).toBe(expected);
    expect(typeKeyByKey(text, 'JPY').at(-1)).toMatchObject({ ok: true, minor: expected });
  });

  it('reads the KRW marker and rejects the JPY one', () => {
    expect(minorOf('₩ 1.500', 'KRW')).toBe(1500n);
    expect(minorOf('1.234', 'KRW')).toBe(1234n);
    expect(errorOf('₩ 1.500', 'JPY')).toContain('Este campo é em JPY');
    expect(errorOf('JP¥ 1.500', 'KRW')).toContain('Este campo é em KRW');
  });

  it.each([
    '1,5',
    '1.5',
    '1.23',
    '12,34',
    '1.2345',
    '5,',
    ',5',
    '1.2.3',
    '1.234,5',
    '-1',
    '0,001',
    '0.500',
    '0.000',
    '1,234.567',
    '1.234,567',
    '1.234,5678',
    '12 50',
    '1 2',
    '1 234,5',
  ])(
    'rejects %s (no decimals, no mixed separators) instead of turning it into another amount',
    (text) => {
      expect(minorOf(text, 'JPY')).toBeNull();
      expect(errorOf(text, 'JPY')).toEqual(expect.any(String));
    },
  );
  it('explains the no-decimals rule', () => {
    expect(errorOf('1,5', 'JPY')).toContain('não tem casas decimais');
    expect(errorOf('1,234.567', 'JPY')).toContain('não tem casas decimais');
  });
});

describe('amount input: 3-decimal currencies', () => {
  it('reads a separator followed by up to 3 digits as decimal', () => {
    expect(parseAmount('1,234', 3, 'KWD')).toMatchObject({ ok: true, minor: 1234n });
    expect(parseAmount('1.234,567', 3, 'KWD')).toMatchObject({ ok: true, minor: 1234567n });
    expect(parseAmount('1,5', 3)).toMatchObject({ ok: true, minor: 1500n });
    expect(parseAmount('1,2345', 3).error).toContain('no máximo 3 casas');
  });
});

describe('amount input: typing equals pasting, differential and generated checks', () => {
  // Deterministic LCG: the same cases on every run.
  let seed = 123456789;
  const next = (max: number) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed % max;
  };

  const alphabet = ['0', '1', '2', '5', '9', '.', ',', ' ', ' ', ' ', 'a', '-', '\t'];
  const prefixes = [
    '',
    '',
    '',
    'R$',
    'R$ ',
    'r$ ',
    'US$ ',
    'BRL',
    'brl ',
    '$',
    '€ ',
    'JP¥ ',
    'jpy ',
    'JPY',
    'xyz$',
  ];
  const randomText = () =>
    prefixes[next(prefixes.length)] +
    Array.from({ length: 1 + next(10) }, () => alphabet[next(alphabet.length)]).join('');

  it('agrees with the reference parser on 60000 generated texts per currency', () => {
    let accepted = 0;
    for (let i = 0; i < 60000; i++) {
      const text = randomText();
      for (const currency of ['BRL', 'JPY'] as const) {
        const expected = referenceParse(text, currency);
        if (expected !== null) accepted++;
        expect(minorOf(text, currency), `${JSON.stringify(text)} ${currency}`).toBe(expected);
      }
    }
    expect(accepted).toBeGreaterThan(3000); // the generator does reach the valid shapes
  });

  it('is a pure function: the typed state equals a fresh paste of the same prefix', () => {
    for (let i = 0; i < 2000; i++) {
      const text = randomText();
      typeKeyByKey(text, 'BRL').forEach((state, index) => {
        expect(state).toEqual(read(text.slice(0, index + 1), 'BRL'));
      });
    }
  });

  it('never invents or drops digits: a valid result keeps every digit typed', () => {
    for (let i = 0; i < 5000; i++) {
      const text = randomText();
      const result = read(text, 'BRL');
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
          plain.replace(/\./g, ' '),
        ];
        for (const variant of variants) {
          expect(minorOf(variant, currency), `${currency} ${variant}`).toBe(minor);
          expect(typeKeyByKey(variant, currency).at(-1), `${currency} ${variant}`).toMatchObject({
            ok: true,
            minor,
          });
        }
      }
    }
  }, 30_000); // heavy randomized loop: slow CI runners exceed the default 5 s
});

describe('percentage input', () => {
  it.each([
    ['33,33', 3333n],
    ['33.33', 3333n],
    ['50', 5000n],
    ['0,05', 5n],
    ['100', 10000n],
    ['50%', 5000n],
    ['33,33 %', 3333n],
    [',5', 50n],
    ['5,', 500n],
  ])('reads %s as %s basis points', (text, expected) => {
    expect(parsePercentInput(text)).toBe(expected);
  });

  it.each([
    ['1.000', 'no máximo 2 casas'],
    ['33,333', 'no máximo 2 casas'],
    ['0,005', 'no máximo 2 casas'],
    ['1,2,3', 'uma só vírgula'],
    ['1.000,5', 'uma só vírgula'],
    ['-5', 'negativa'],
    ['abc', 'apenas números'],
    ['5%%', 'apenas números'],
    ['%5', 'apenas números'],
    ['1 000', 'apenas números'],
    ['R$ 5', 'apenas números'],
  ])('rejects %s with a percentage message', (text, part) => {
    expect(parsePercentInput(text)).toBeNull();
    const error = parsePercent(text).error;
    expect(error).toContain(part);
    expect(error).not.toContain('moeda');
  });

  it('treats empty text as nothing typed', () => {
    expect(parsePercent('')).toEqual({ ok: false, error: null });
    expect(parsePercent(' % ')).toEqual({ ok: false, error: null });
  });

  it('agrees with an independent reference on generated texts', () => {
    let seed = 42;
    const next = (max: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % max;
    };
    const alphabet = ['0', '3', '5', '.', ',', ' ', '%', '-', 'a'];
    for (let i = 0; i < 20000; i++) {
      const text = Array.from({ length: 1 + next(8) }, () => alphabet[next(alphabet.length)]).join(
        '',
      );
      const t = text.trim().replace(/\s*%$/, '');
      const m = /^(\d*)(?:[.,](\d{0,2}))?$/.exec(t);
      const expected = t === '' || !m ? null : BigInt((m[1] || '0') + (m[2] ?? '').padEnd(2, '0'));
      expect(parsePercentInput(text), JSON.stringify(text)).toBe(expected);
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
    expect(minorOf('10.000.000,00', 'BRL')).toBe(MAX_AMOUNT_MINOR);
    expect(check(1_000_000_000).success).toBe(true);
    const over = check(1_000_000_001);
    expect(over.success).toBe(false);
    expect(JSON.stringify(over.error?.issues)).toContain('no máximo 1.000.000.000');
    expect(minorOf('10.000.000,01', 'BRL')).toBe(MAX_AMOUNT_MINOR + 1n);
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
