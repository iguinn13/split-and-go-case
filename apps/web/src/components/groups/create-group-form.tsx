'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { fieldClassName, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
  // Live validation: a field shows its error once it was left (blur) or after a submit attempt.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (id: string) => setTouched((current) => ({ ...current, [id]: true }));
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
  const show = (path: string, id = path) => (submitted || touched[id] ? errors[path] : undefined);

  // Errors are keyed by position in `filled`; map them back to the visible rows.
  const rowError = (row: MemberRow, field: 'name' | 'email') => {
    const index = filled.indexOf(row);
    if (index >= 0) return show(`members.${index}.${field}`, `${row.key}.${field}`);
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
      {serverError ? <Alert>{serverError}</Alert> : null}

      <Input
        id="group-name"
        label="Nome do grupo"
        name="name"
        value={name}
        error={show('name')}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => touch('name')}
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
          onBlur={() => touch('description')}
          aria-invalid={show('description') ? true : undefined}
          aria-describedby={show('description') ? 'description-error' : undefined}
          className={cn(
            fieldClassName,
            show('description') ? 'border-destructive-soft-foreground' : 'border-input',
          )}
        />
        {show('description') ? (
          <p
            id="description-error"
            className="text-sm font-medium text-destructive-soft-foreground"
          >
            Erro: {show('description')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Select
          id="baseCurrency"
          name="baseCurrency"
          label="Moeda-base"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          aria-describedby="baseCurrency-hint"
          options={currencies.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
        />
        <p id="baseCurrency-hint" className="text-sm text-muted-foreground">
          Saldos e liquidação serão expressos nesta moeda. Não pode ser alterada depois.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Participantes</legend>
        <p className="text-sm text-muted-foreground">
          Você entra no grupo automaticamente como dono. Adicione os demais participantes agora ou
          depois.
        </p>
        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={row.name || '?'} size="sm" decorative />
                  <span className="min-w-0 break-words text-sm font-semibold">
                    {row.name.trim() || `Participante ${index + 1}`}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 aria-hidden />}
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  aria-label={`Remover participante ${index + 1}`}
                >
                  Remover
                </Button>
              </div>
              <Input
                id={`member-${row.key}-name`}
                label={`Nome do participante ${index + 1}`}
                value={row.name}
                error={rowError(row, 'name')}
                onChange={(e) => updateRow(row.key, { name: e.target.value })}
                onBlur={() => touch(`${row.key}.name`)}
                autoComplete="off"
                maxLength={60}
              />
              <Input
                id={`member-${row.key}-email`}
                label={`E-mail do participante ${index + 1} (opcional)`}
                type="email"
                inputMode="email"
                value={row.email}
                error={rowError(row, 'email')}
                onChange={(e) => updateRow(row.key, { email: e.target.value })}
                onBlur={() => touch(`${row.key}.email`)}
                autoComplete="off"
              />
            </li>
          ))}
        </ul>
        {show('members') ? (
          <p className="text-sm font-medium text-destructive-soft-foreground">
            Erro: {show('members')}
          </p>
        ) : null}
        <Button
          variant="secondary"
          className="self-start"
          icon={<Plus aria-hidden />}
          disabled={rows.length >= MAX_MEMBERS}
          onClick={() =>
            setRows((current) => [...current, { key: nextKey.current++, name: '', email: '' }])
          }
        >
          Adicionar participante
        </Button>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/groups" className={buttonVariants({ variant: 'secondary' })}>
          Cancelar
        </Link>
        <Button type="submit" loading={pending}>
          {pending ? 'Criando grupo...' : 'Criar grupo'}
        </Button>
      </div>
    </form>
  );
}
