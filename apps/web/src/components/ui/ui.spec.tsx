import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';
import { Badge } from './badge';
import { Button } from './button';
import { ErrorState } from './error-state';
import { Input } from './input';
import { NavTabs } from './nav-tabs';
import { PageHeader } from './page-header';
import { Skeleton } from './skeleton';
import { Wordmark } from './wordmark';
import { Select } from './select';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('Button', () => {
  it('defaults to type=button and has no aria-busy', () => {
    const out = html(<Button>Salvar</Button>);
    expect(out).toContain('type="button"');
    expect(out).not.toContain('aria-busy=');
  });

  it('is busy and disabled while loading, keeping the label', () => {
    const out = html(<Button loading>Salvando</Button>);
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('disabled=""');
    expect(out).toContain('Salvando');
  });

  it('renders the icon decoratively', () => {
    const out = html(<Button icon={<svg data-icon aria-hidden="true" />}>Sair</Button>);
    expect(out).toContain('data-icon');
  });
});

describe('Input', () => {
  it('links label, hint and error through explicit ids', () => {
    const out = html(
      <Input id="email" label="E-mail" hint="Use o e-mail do cadastro" error="Inválido" />,
    );
    expect(out).toContain('<label for="email"');
    expect(out).toContain('id="email"');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('aria-describedby="email-hint email-error"');
    expect(out).toContain('id="email-hint"');
    expect(out).toContain('id="email-error"');
    expect(out).toContain('Erro: Inválido');
  });

  it('merges caller describedBy and announces the error only on request', () => {
    const quiet = html(<Input id="amount" label="Valor" error="x" describedBy="amount-preview" />);
    expect(quiet).toContain('aria-describedby="amount-preview amount-error"');
    expect(quiet).not.toContain('role="alert"');
    expect(html(<Input id="amount" label="Valor" error="x" announceError />)).toContain(
      'role="alert"',
    );
  });

  it('has no aria wiring without hint or error and rejects ids with whitespace', () => {
    const out = html(<Input id="name" label="Nome" />);
    expect(out).not.toContain('aria-describedby');
    expect(out).not.toContain('aria-invalid');
    expect(() => html(<Input id="bad id" label="Nome" />)).toThrow();
  });
});

describe('Select', () => {
  it('is a native select labelled and described by its error', () => {
    const out = html(
      <Select
        id="currency"
        label="Moeda"
        error="Obrigatória"
        options={[{ value: 'BRL', label: 'Real' }]}
      />,
    );
    expect(out).toContain('<label for="currency"');
    expect(out).toContain('<select id="currency"');
    expect(out).toContain('aria-describedby="currency-error"');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('<option value="BRL">Real</option>');
  });
});

describe('NavTabs', () => {
  const items = [
    { id: 'a', label: 'Despesas', href: '/g?tab=a' },
    { id: 'b', label: 'Saldos', href: '/g?tab=b' },
  ];

  it('is a labelled nav and marks only the active link as current page', () => {
    const out = html(<NavTabs label="Seções do grupo" items={items} activeId="b" />);
    expect(out).toContain('<nav aria-label="Seções do grupo"');
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="page"[^>]*>.*Saldos/);
    expect(out).toContain('href="/g?tab=a"');
  });
});

describe('Avatar, Badge and ErrorState', () => {
  it('exposes the person name as the avatar label, or hides it when decorative', () => {
    expect(html(<Avatar name="Ana Souza" />)).toContain('role="img" aria-label="Ana Souza"');
    const hidden = html(<Avatar name="Ana Souza" decorative />);
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).not.toContain('aria-label');
  });

  it('renders badge text', () => {
    expect(html(<Badge variant="warning">Fechado</Badge>)).toContain('Fechado');
  });

  it('keeps the alert role and the "Erro:" prefix', () => {
    const out = html(<ErrorState title="Falhou" message="Tente de novo" />);
    expect(out).toContain('role="alert"');
    expect(out).toContain('Erro: Falhou');
  });
});

describe('Skeleton, PageHeader and Wordmark', () => {
  it('announces the skeleton as a loading status', () => {
    const out = html(<Skeleton />);
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-label="Carregando"');
  });

  it('renders a single h1, the back link and the actions', () => {
    const out = html(
      <PageHeader
        title="Viagem"
        description="BRL"
        backHref="/groups"
        backLabel="Voltar aos grupos"
        actions={<button>Editar</button>}
      />,
    );
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('href="/groups"');
    expect(out).toContain('Voltar aos grupos');
    expect(out).toContain('Editar');
  });

  it('prints the product name and hides the decorative icon', () => {
    const out = html(<Wordmark />);
    expect(out).toContain('Split&amp;Go');
    expect(out).toContain('aria-hidden="true"');
  });

  it('gives the active tab a non-colour cue for forced-colors mode', () => {
    const out = html(
      <NavTabs label="x" items={[{ id: 'a', label: 'A', href: '/a' }]} activeId="a" />,
    );
    expect(out).toContain('forced-colors:underline');
  });

  it('keeps full opacity on a loading button', () => {
    expect(html(<Button loading>Salvando</Button>)).toContain('aria-busy:disabled:opacity-100');
  });
});
