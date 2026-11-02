import { describe, expect, it } from 'vitest';
import { conversionLine } from '@/lib/expenses/format';
import { balanceStatus, magnitude, statementHref } from './status';
import type { Statement } from './types';

describe('balanceStatus', () => {
  it('labels positive, negative and zero balances', () => {
    expect(balanceStatus(1).label).toBe('recebe');
    expect(balanceStatus(-1).label).toBe('deve');
    expect(balanceStatus(0).label).toBe('quitado');
  });

  it('uses a distinct icon per state so color is never the only cue', () => {
    const icons = [1, -1, 0].map((n) => balanceStatus(n).icon);
    expect(new Set(icons).size).toBe(3);
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

describe('statement total vs balance', () => {
  it('statement total equals the member net shown on the balances tab', () => {
    const lines: Statement['lines'] = [
      {
        expenseId: 'a',
        description: 'a',
        occurredOn: '2026-07-10',
        original: null,
        paidMinor: 10000,
        owedMinor: 2500,
        netMinor: 7500,
        runningBalanceMinor: 7500,
      },
      {
        expenseId: 'b',
        description: 'b',
        occurredOn: '2026-07-11',
        original: null,
        paidMinor: 0,
        owedMinor: 3000,
        netMinor: -3000,
        runningBalanceMinor: 4500,
      },
    ];
    const net = lines.reduce((sum, l) => sum + l.netMinor, 0);
    expect(lines.at(-1)?.runningBalanceMinor).toBe(net);
    expect(balanceStatus(net).label).toBe('recebe');
  });
});
