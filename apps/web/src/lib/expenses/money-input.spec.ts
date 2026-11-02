import { describe, expect, it } from 'vitest';
import {
  displayRate,
  formatBasisPoints,
  parseAmountInput,
  parsePercentInput,
  sanitizeAmountInput,
  sanitizeRateInput,
  toApiRate,
} from './money-input';

describe('amount mask', () => {
  it('converts 2-decimal input to minor units', () => {
    expect(parseAmountInput('100', 2)).toBe(10000n);
    expect(parseAmountInput('100,5', 2)).toBe(10050n);
    expect(parseAmountInput('10.01', 2)).toBe(1001n);
    expect(parseAmountInput('0,05', 2)).toBe(5n);
    expect(parseAmountInput(',5', 2)).toBe(50n);
  });

  it('JPY/KRW accept no decimals', () => {
    expect(sanitizeAmountInput('1572,5', 0)).toBe('15725');
    expect(parseAmountInput('5.000', 0)).toBe(5000n);
    expect(parseAmountInput('5000', 0)).toBe(5000n);
  });

  it('truncates extra decimals and strips junk', () => {
    expect(sanitizeAmountInput('12,3456', 2)).toBe('12,34');
    expect(sanitizeAmountInput('abc1x2', 2)).toBe('12');
    expect(sanitizeAmountInput('007', 2)).toBe('7');
    expect(sanitizeAmountInput('1,2,3', 2)).toBe('1,23');
  });

  it('returns null for empty input and stays exact for huge values', () => {
    expect(parseAmountInput('', 2)).toBeNull();
    expect(parseAmountInput(',', 2)).toBeNull();
    expect(parseAmountInput('900719925474,99', 2)).toBe(90071992547499n);
  });

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
