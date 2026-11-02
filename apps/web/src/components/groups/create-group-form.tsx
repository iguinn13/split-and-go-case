'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mutate } from '@/lib/groups/client';
import { createGroupFormSchema, dropBlankMembers, pathErrors } from '@/lib/groups/schemas';
import type { CurrencyOption } from '@/lib/groups/types';

interface MemberRow {
  key: number;
  name: string;
  email: string;
}

const MAX_MEMBERS = 49; // 50 total, the owner is added by the API

export function CreateGroupForm({ currencies }: { currencies: CurrencyOption[] }) {
  const router = useRouter();
  const nextKey = useRef(2);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseCurrency, setBaseCurrency] = useState(
    currencies.some((c) => c.code === 'BRL') ? 'BRL' : (currencies[0]?.code ?? ''),
  );
  const [rows, setRows] = useState<MemberRow[]>([{ key: 1, name: '', email: '' }]);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const filled = dropBlankMembers(rows);
  const result = createGroupFormSchema.safeParse({
    name,
    description,
    baseCurrency,
    members: filled.map(({ name: n, email }) => ({ name: n, email })),
  });
  const errors = result.success ? {} : pathErrors(result.error);
  const show = (path: string) => (submitted ? errors[path] : undefined);

  // Errors are keyed by position in `filled`; map them back to the visible rows.
  const rowError = (row: MemberRow, field: 'name' | 'email') => {
    const index = filled.indexOf(row);
    if (index >= 0) return show(`members.${index}.${field}`);
    return undefined;
  };

  function updateRow(key: number, patch: Partial<MemberRow>) {
    setServerError(null);
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    if (!result.success) return;
    setPending(true);
    setServerError(null);
    const response = await mutate<{ id: string }>('/api/groups', {
      method: 'POST',
      body: result.data,
    });
    if (!response.ok) {
      setServerError(response.message);
      setPending(false);
      return;
    }
    router.replace(`/groups/${response.data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="flex flex-col gap-4"
      aria-busy={pending}
    >
      {serverError ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-700 bg-danger-50 px-3 py-2 text-sm text-danger-700"
        >
          Erro: {serverError}
        </div>
      ) : null}

      <Input
        label="Nome do grupo"
        name="name"
        value={name}
        error={show('name')}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        maxLength={80}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Descrição (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={show('description') ? true : undefined}
          aria-describedby={show('description') ? 'description-error' : undefined}
          className="rounded-lg border border-line bg-surface px-3 py-2"
        />
        {show('description') ? (
          <p id="description-error" className="text-sm text-danger-700">
            Erro: {show('description')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="baseCurrency" className="text-sm font-medium">
          Moeda-base
        </label>
        <select
          id="baseCurrency"
          name="baseCurrency"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          aria-describedby="baseCurrency-hint"
          className="min-h-11 rounded-lg border border-line bg-surface px-3 py-2"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} - {c.name}
            </option>
          ))}
        </select>
        <p id="baseCurrency-hint" className="text-sm text-muted">
          Saldos e liquidação serão expressos nesta moeda. Não pode ser alterada depois.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Participantes</legend>
        <p className="text-sm text-muted">
          Você entra no grupo automaticamente como dono. Adicione os demais participantes agora ou
          depois.
        </p>
        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
            >
              <Input
                label={`Nome do participante ${index + 1}`}
                value={row.name}
                error={rowError(row, 'name')}
                onChange={(e) => updateRow(row.key, { name: e.target.value })}
                autoComplete="off"
                maxLength={60}
              />
              <Input
                label={`E-mail do participante ${index + 1} (opcional)`}
                type="email"
                inputMode="email"
                value={row.email}
                error={rowError(row, 'email')}
                onChange={(e) => updateRow(row.key, { email: e.target.value })}
                autoComplete="off"
              />
              <Button
                variant="secondary"
                className="self-start"
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                aria-label={`Remover participante ${index + 1}`}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
        {show('members') ? (
          <p className="text-sm text-danger-700">Erro: {show('members')}</p>
        ) : null}
        <Button
          variant="secondary"
          className="self-start"
          disabled={rows.length >= MAX_MEMBERS}
          onClick={() =>
            setRows((current) => [...current, { key: nextKey.current++, name: '', email: '' }])
          }
        >
          Adicionar participante
        </Button>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={pending}>
          {pending ? 'Criando grupo...' : 'Criar grupo'}
        </Button>
        <Link
          href="/groups"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-brand-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
