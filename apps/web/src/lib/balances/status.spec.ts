import { describe, expect, it } from 'vitest';
import { conversionLine } from '@/lib/expenses/format';
import { balanceStatus, magnitude, statementHref } from './status';

describe('balanceStatus', () => {
  it('maps a positive balance to + / recebe / positive', () => {
    const s = balanceStatus(1);
    expect([s.kind, s.icon, s.label]).toEqual(['receives', '+', 'recebe']);
    expect(s.textClass).toBe('text-positive');
    expect(s.borderClass).toBe('border-l-positive');
  });

  it('maps a negative balance to − / deve / negative', () => {
    const s = balanceStatus(-1);
    expect([s.kind, s.icon, s.label]).toEqual(['owes', '−', 'deve']);
    expect(s.textClass).toBe('text-negative');
    expect(s.borderClass).toBe('border-l-negative');
  });

  it('exposes the first-person headline for the signed-in user', () => {
    expect(balanceStatus(5).selfHeadline).toBe('Você recebe');
    expect(balanceStatus(-5).selfHeadline).toBe('Você deve');
    expect(balanceStatus(0).selfHeadline).toBe('Você está quitado');
  });

  it('maps zero to ✓ / quitado / muted', () => {
    const s = balanceStatus(0);
    expect([s.kind, s.icon, s.label]).toEqual(['settled', '✓', 'quitado']);
    expect(s.textClass).toBe('text-muted-foreground');
    expect(s.borderClass).toBe('border-l-input');
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

describe('conversionLine for zero-decimal currencies', () => {
  it('formats JPY without decimals and a non-payer line with the persisted converted total', () => {
    const text = conversionLine(
      { currency: 'JPY', amountMinor: 5000, exchangeRate: '0.0350' },
      17500,
      'BRL',
    );
    expect(text.split(' · ')).toHaveLength(3);
    expect(text).toMatch(/^JP¥\s?5\.000 · taxa 0,035 · R\$\s?175,00$/);
  });
});
