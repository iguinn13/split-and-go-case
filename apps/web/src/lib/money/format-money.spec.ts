import { describe, expect, it } from 'vitest';
import { formatMoney } from './format-money';

// Intl uses a non-breaking space between symbol and number.
const norm = (s: string) => s.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');

describe('formatMoney', () => {
  it('formats 2-decimal currencies', () => {
    expect(norm(formatMoney(123456, 'BRL'))).toBe('R$ 1.234,56');
    expect(norm(formatMoney(10000, 'USD'))).toBe('US$ 100,00');
  });

  it('formats 0-decimal currencies without dividing', () => {
    expect(norm(formatMoney(5000, 'JPY'))).toBe('JP¥ 5.000');
    expect(norm(formatMoney(1500, 'KRW'))).toBe('₩ 1.500');
  });

  it('pads small amounts', () => {
    expect(norm(formatMoney(5, 'BRL'))).toBe('R$ 0,05');
    expect(norm(formatMoney(0, 'BRL'))).toBe('R$ 0,00');
  });

  it('handles negatives and very large values exactly', () => {
    expect(norm(formatMoney(-250, 'EUR'))).toContain('2,50');
    expect(norm(formatMoney(-250, 'EUR'))).toContain('-');
    expect(norm(formatMoney(9007199254740993n, 'BRL'))).toBe('R$ 90.071.992.547.409,93');
  });

  it('rejects unknown currencies', () => {
    expect(() => formatMoney(1, 'XYZ')).toThrow();
  });
});
