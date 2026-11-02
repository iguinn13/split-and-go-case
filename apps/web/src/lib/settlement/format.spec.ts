import { describe, expect, it } from 'vitest';
import {
  paidSummary,
  totalMovedLabel,
  transferCountLabel,
  transferSentence,
  transferSentenceParts,
  transferStatusView,
} from './format';

const duda = { memberId: 'm1', name: 'Duda' };
const ana = { memberId: 'm2', name: 'Ana' };

describe('transferSentence', () => {
  it('reads "payer paga amount para receiver" from the from/to members', () => {
    const t = { from: duda, to: ana, amountMinor: 5000 };
    expect(transferSentence(t, 'BRL').replace(/\s/g, ' ')).toBe('Duda paga R$ 50,00 para Ana');
    expect(transferSentence({ ...t, from: ana, to: duda }, 'BRL').replace(/\s/g, ' ')).toBe(
      'Ana paga R$ 50,00 para Duda',
    );
  });

  it('uses 0 decimals for JPY and KRW and 2 for USD', () => {
    const base = { from: duda, to: ana };
    expect(transferSentence({ ...base, amountMinor: 5000 }, 'JPY').replace(/\s/g, ' ')).toBe(
      'Duda paga JP¥ 5.000 para Ana',
    );
    expect(transferSentence({ ...base, amountMinor: 123456 }, 'KRW').replace(/\s/g, ' ')).toBe(
      'Duda paga ₩ 123.456 para Ana',
    );
    expect(transferSentence({ ...base, amountMinor: 10050 }, 'USD').replace(/\s/g, ' ')).toBe(
      'Duda paga US$ 100,50 para Ana',
    );
  });

  it('exposes the parts separately', () => {
    const parts = transferSentenceParts({ from: duda, to: ana, amountMinor: 5 }, 'BRL');
    expect(parts.from).toBe('Duda');
    expect(parts.to).toBe('Ana');
    expect(parts.amount.replace(/\s/g, ' ')).toBe('R$ 0,05');
  });
});

describe('labels', () => {
  it('pluralizes the transfer count', () => {
    expect(transferCountLabel(1)).toBe('1 transferência');
    expect(transferCountLabel(3)).toBe('3 transferências');
  });

  it('formats the total moved in the base currency', () => {
    expect(totalMovedLabel(123456, 'BRL').replace(/\s/g, ' ')).toBe(
      'Total movimentado: R$ 1.234,56',
    );
  });
});

describe('paidSummary', () => {
  it('counts only PAID transfers against the total', () => {
    expect(paidSummary([{ status: 'PAID' }, { status: 'PENDING' }, { status: 'PENDING' }])).toBe(
      '1 de 3 pagas',
    );
    expect(paidSummary([{ status: 'PAID' }, { status: 'PAID' }])).toBe('2 de 2 pagas');
    expect(paidSummary([])).toBe('0 de 0 pagas');
  });
});

describe('transferStatusView', () => {
  it('PAID is a check with text and green', () => {
    expect(transferStatusView('PAID')).toEqual({
      label: 'Paga',
      icon: '✓',
      className: 'text-emerald-800',
    });
  });

  it('PENDING has its own icon and text, not only a color', () => {
    expect(transferStatusView('PENDING')).toEqual({
      label: 'Pendente',
      icon: '◷',
      className: 'text-muted',
    });
  });
});
