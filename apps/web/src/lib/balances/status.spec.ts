import { describe, expect, it } from 'vitest';
import { conversionLine } from '@/lib/expenses/format';
import { balanceStatus, lineConvertedMinor, magnitude, statementHref } from './status';

describe('balanceStatus', () => {
  it('maps a positive balance to + / recebe / emerald', () => {
    const s = balanceStatus(1);
    expect([s.kind, s.icon, s.label]).toEqual(['receives', '+', 'recebe']);
    expect(s.textClass).toBe('text-emerald-800');
    expect(s.borderClass).toBe('border-l-emerald-700');
  });

  it('maps a negative balance to − / deve / danger', () => {
    const s = balanceStatus(-1);
    expect([s.kind, s.icon, s.label]).toEqual(['owes', '−', 'deve']);
    expect(s.textClass).toBe('text-danger-700');
    expect(s.borderClass).toBe('border-l-danger-700');
  });

  it('maps zero to ✓ / quitado / muted', () => {
    const s = balanceStatus(0);
    expect([s.kind, s.icon, s.label]).toEqual(['settled', '✓', 'quitado']);
    expect(s.textClass).toBe('text-muted');
    expect(s.borderClass).toBe('border-l-line');
  });
});

describe('magnitude', () => {
  it('drops the sign', () => {
    expect(magnitude(-543)).toBe(543);
    expect(magnitude(7)).toBe(7);
    expect(magnitude(0)).toBe(0);
  });
});

describe('statementHref', () => {
  it('builds the member statement link', () => {
    expect(statementHref('g', 'm')).toBe('/groups/g/members/m');
  });
});

describe('conversionLine', () => {
  it('shows original, rate and converted amount', () => {
    const text = conversionLine(
      { currency: 'USD', amountMinor: 10000, exchangeRate: '5.43250000' },
      54325,
      'BRL',
    );
    expect(text).toContain('taxa 5,4325');
    expect(text).toMatch(/US\$\s?100,00/);
    expect(text).toMatch(/R\$\s?543,25/);
  });
});

describe('conversionLine without converted amount', () => {
  it('omits the converted part', () => {
    const text = conversionLine(
      { currency: 'JPY', amountMinor: 5000, exchangeRate: '0.0350' },
      null,
      'BRL',
    );
    expect(text).toContain('taxa 0,035');
    expect(text.split(' · ')).toHaveLength(2);
  });
});

describe('lineConvertedMinor', () => {
  it('returns the converted total only when the member paid it', () => {
    expect(lineConvertedMinor({ paidMinor: 162975 })).toBe(162975);
    expect(lineConvertedMinor({ paidMinor: 0 })).toBeNull();
  });
});
