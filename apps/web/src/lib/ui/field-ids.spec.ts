import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { fieldAria } from './field-ids';

describe('fieldAria', () => {
  it('has no description without hints or errors', () => {
    expect(fieldAria('email', false).describedBy).toBeUndefined();
  });

  it('points to the error id only when there is an error', () => {
    expect(fieldAria('email', true)).toEqual({
      errorId: 'email-error',
      describedBy: 'email-error',
    });
  });

  it('merges hint ids before the error id', () => {
    expect(fieldAria('rate', true, 'rate-hint').describedBy).toBe('rate-hint rate-error');
    expect(fieldAria('rate', false, 'rate-hint').describedBy).toBe('rate-hint');
    expect(fieldAria('rate', true, 'a   b').describedBy).toBe('a b rate-error');
  });

  it('rejects ids that are empty or contain whitespace', () => {
    expect(() => fieldAria('Nome do grupo', false)).toThrow();
    expect(() => fieldAria('', false)).toThrow();
    expect(() => fieldAria('a\tb', true)).toThrow();
  });
});

describe('Input', () => {
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(Input, { id: 'group-name', label: 'Nome do grupo', ...props }),
    );

  it('links label, input, hint and error through whitespace-free ids', () => {
    const html = render({ error: 'Informe o nome.', describedBy: 'group-name-hint' });
    expect(html).toContain('<label for="group-name"');
    expect(html).toContain('id="group-name"');
    expect(html).toContain('aria-describedby="group-name-hint group-name-error"');
    expect(html).toContain('id="group-name-error"');
    expect(html).toContain('aria-invalid="true"');
    for (const [, value] of html.matchAll(/\b(?:id|for|aria-describedby)="([^"]*)"/g)) {
      expect(value).not.toMatch(/^\s|\s\s/);
    }
    expect(html).not.toMatch(/id="[^"]*\s[^"]*"/);
  });

  it('renders no error element or aria attributes when valid', () => {
    const html = render({});
    expect(html).not.toContain('-error');
    expect(html).not.toContain('aria-describedby');
    expect(html).not.toContain('aria-invalid');
  });

  it('never derives the id from the label or the name', () => {
    const html = render({ name: 'some name', id: 'custom-id' });
    expect(html).toContain('id="custom-id"');
    expect(html).not.toContain('id="some name"');
    expect(html).not.toContain('id="Nome do grupo"');
  });
});

describe('Select', () => {
  it('announces the error through its explicit id', () => {
    const html = renderToStaticMarkup(
      createElement(Select, {
        id: 'expense-paid-by',
        label: 'Pago por',
        error: 'Escolha quem pagou.',
        options: [{ value: 'a', label: 'Ana' }],
      }),
    );
    expect(html).toContain('<label for="expense-paid-by"');
    expect(html).toContain('aria-describedby="expense-paid-by-error"');
    expect(html).toContain('id="expense-paid-by-error"');
  });
});
