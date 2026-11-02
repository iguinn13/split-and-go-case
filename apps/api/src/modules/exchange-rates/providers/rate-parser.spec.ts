import { describe, expect, it } from 'vitest';
import { extractRateToken, normalizeRate } from './rate-parser.js';

describe('extractRateToken', () => {
  it('keeps the raw token without float conversion', () => {
    const json = '{"amount":1,"base":"USD","date":"2026-07-10","rates":{"BRL":5.43251234567891}}';
    expect(extractRateToken(json, 'BRL')).toBe('5.43251234567891');
  });
  it('returns null for missing symbol, scientific notation, strings or negatives', () => {
    expect(extractRateToken('{"rates":{"EUR":1.1}}', 'BRL')).toBeNull();
    expect(extractRateToken('{"rates":{"BRL":1e-9}}', 'BRL')).toBeNull();
    expect(extractRateToken('{"rates":{"BRL":"5.4"}}', 'BRL')).toBeNull();
    expect(extractRateToken('{"rates":{"BRL":-5.4}}', 'BRL')).toBeNull();
    expect(extractRateToken('{}', 'BRL')).toBeNull();
  });
});

describe('normalizeRate', () => {
  it('strips trailing zeros and keeps up to 8 decimals', () => {
    expect(normalizeRate('5.4325')).toBe('5.4325');
    expect(normalizeRate('5.43250000')).toBe('5.4325');
    expect(normalizeRate('157')).toBe('157');
    expect(normalizeRate('1.0')).toBe('1');
    expect(normalizeRate('0.0345')).toBe('0.0345');
  });
  it('rounds half up beyond 8 decimals (not truncate)', () => {
    expect(normalizeRate('1.123456784')).toBe('1.12345678');
    expect(normalizeRate('1.123456785')).toBe('1.12345679');
    expect(normalizeRate('0.999999999')).toBe('1');
    expect(normalizeRate('0.000000005')).toBe('0.00000001');
  });
  it('keeps precision a double would lose', () => {
    expect(normalizeRate('12345.12345678')).toBe('12345.12345678');
  });
  it('rejects zero, overflow and non-decimal input', () => {
    expect(normalizeRate('0')).toBeNull();
    expect(normalizeRate('0.000000004')).toBeNull();
    expect(normalizeRate('12345678901')).toBeNull();
    expect(normalizeRate('1e5')).toBeNull();
    expect(normalizeRate('-1')).toBeNull();
  });
});
