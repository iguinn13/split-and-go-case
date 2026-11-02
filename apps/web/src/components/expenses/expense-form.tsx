'use client';

import { Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Input } from '@/components/ui/input';
import { SESSION_EXPIRED_PATH } from '@/lib/auth/paths';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { expensesHref, todayIso } from '@/lib/expenses/format';
import {
  displayRate,
  formatBasisPoints,
  minorUnitsOf,
  amountInputText,
  parseAmount,
  parseAmountInput,
  parsePercent,
  parsePercentInput,
  sanitizeRateInput,
  toApiRate,
} from '@/lib/expenses/money-input';
import { buildExpensePayloadSchema, type ExpensePayload } from '@/lib/expenses/schemas';
import { previewSplit, type SplitDraft } from '@/lib/expenses/split-preview';
import type { Expense, ExchangeRateSuggestion, SplitType } from '@/lib/expenses/types';
import { mutate } from '@/lib/groups/client';
import type { CurrencyOption, Member } from '@/lib/groups/types';
import { formatMoney } from '@/lib/money/format-money';

interface Props {
  groupId: string;
  baseCurrency: string;
  members: Member[];
  currencies: CurrencyOption[];
  /** Member linked to the signed-in user: default payer. */
  currentMemberId: string | undefined;
  /** Present when editing. */
  expense?: Expense;
}

type SuggestionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; source: string; date: string }
  | { status: 'error' };

const SECTION = 'flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card';

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: 'EQUAL', label: 'Igualmente' },
  { value: 'PERCENTAGE', label: 'Por porcentagem' },
  { value: 'FIXED', label: 'Por valor fixo' },
];

export function ExpenseForm({
  groupId,
  baseCurrency,
  members,
  currencies,
  currentMemberId,
  expense,
}: Props) {
  const router = useRouter();
  const editing = expense !== undefined;
  const initialCurrency = expense?.currency ?? baseCurrency;

  const [description, setDescription] = useState(expense?.description ?? '');
  const [currency, setCurrency] = useState(initialCurrency);
  const [amount, setAmount] = useState(
    expense ? amountInputText(expense.originalAmountMinor, minorUnitsOf(initialCurrency)) : '',
  );
  const [rate, setRate] = useState(
    expense && expense.currency !== baseCurrency ? displayRate(expense.exchangeRate) : '',
  );
  // Editing keeps the saved snapshot until the user changes the currency or asks for a new one.
  const [rateTouched, setRateTouched] = useState(editing);
  const [suggestion, setSuggestion] = useState<SuggestionState>({ status: 'idle' });
  const [retry, setRetry] = useState(0);
  const [paidBy, setPaidBy] = useState(
    expense?.paidByMemberId ?? currentMemberId ?? members[0]?.id ?? '',
  );
  const [date, setDate] = useState(expense?.occurredOn ?? todayIso());
  const [splitType, setSplitType] = useState<SplitType>(expense?.splitType ?? 'EQUAL');
  const [selected, setSelected] = useState<string[]>(
    expense ? expense.shares.map((s) => s.memberId) : members.map((m) => m.id),
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!expense || expense.splitType === 'EQUAL') return {};
    return Object.fromEntries(
      expense.shares.map((s) => [
        s.memberId,
        expense.splitType === 'PERCENTAGE'
          ? amountInputText(s.basisPoints ?? 0, 2)
          : amountInputText(s.originalAmountMinor, minorUnitsOf(expense.currency)),
      ]),
    );
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  // Synchronous guard: state updates are async, so a fast second click could slip through.
  const submitting = useRef(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const foreign = currency !== baseCurrency;
  const units = minorUnitsOf(currency);
  const amountParse = parseAmount(amount, units, currency);
  const originalAmountMinor = amountParse.ok ? amountParse.minor : null;
  const apiRate = foreign ? toApiRate(rate) : null;

  // Suggestion of the day (RF-UI-09); a failure only shows a warning (RF-UI-11).
  useEffect(() => {
    if (!foreign || rateTouched || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const controller = new AbortController();
    setSuggestion({ status: 'loading' });
    setRate('');
    const query = new URLSearchParams({ from: currency, to: baseCurrency, date });
    fetch(`/api/exchange-rates?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign(SESSION_EXPIRED_PATH);
          return;
        }
        if (!response.ok) {
          setSuggestion({ status: 'error' });
          return;
        }
        const data = (await response.json()) as ExchangeRateSuggestion;
        if (controller.signal.aborted) return;
        setRate(displayRate(data.rate));
        setSuggestion({ status: 'ok', source: data.source, date: data.date });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSuggestion({ status: 'error' });
      });
    return () => {
      controller.abort();
      // An aborted fetch never reports back: do not leave the hint stuck on "loading".
      setSuggestion({ status: 'idle' });
    };
  }, [foreign, currency, baseCurrency, date, rateTouched, retry]);

  function changeCurrency(next: string) {
    setCurrency(next);
    // The raw amount texts stay as typed: they are re-read with the new currency's decimals.
    setRateTouched(false);
    setRate('');
    setSuggestion({ status: 'idle' });
  }

  function toggleMember(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((m) => m !== id) : [...current, id],
    );
  }

  // Selected members, in group order.
  const chosen = members.filter((m) => selected.includes(m.id));
  const draft: SplitDraft =
    splitType === 'EQUAL'
      ? { type: 'EQUAL', memberIds: chosen.map((m) => m.id) }
      : splitType === 'PERCENTAGE'
        ? {
            type: 'PERCENTAGE',
            shares: chosen.map((m) => ({
              memberId: m.id,
              basisPoints: parsePercentInput(values[m.id] ?? ''),
            })),
          }
        : {
            type: 'FIXED',
            shares: chosen.map((m) => ({
              memberId: m.id,
              amountMinor: parseAmountInput(values[m.id] ?? '', units, currency),
            })),
          };

  const preview = previewSplit({
    currency,
    baseCurrency,
    originalAmountMinor,
    exchangeRate: rate,
    split: draft,
  });

  const candidate = {
    description,
    currency,
    ...(foreign && apiRate ? { exchangeRate: apiRate } : {}),
    originalAmountMinor: originalAmountMinor === null ? undefined : Number(originalAmountMinor),
    paidByMemberId: paidBy,
    occurredOn: date,
    split:
      draft.type === 'EQUAL'
        ? { type: 'EQUAL' as const, participantIds: draft.memberIds }
        : draft.type === 'PERCENTAGE'
          ? {
              type: 'PERCENTAGE' as const,
              shares: draft.shares.map((s) => ({
                memberId: s.memberId,
                basisPoints: s.basisPoints === null ? undefined : Number(s.basisPoints),
              })),
            }
          : {
              type: 'FIXED' as const,
              shares: draft.shares.map((s) => ({
                memberId: s.memberId,
                originalAmountMinor: s.amountMinor === null ? undefined : Number(s.amountMinor),
              })),
            },
  };
  const parsed = buildExpensePayloadSchema(baseCurrency).safeParse(candidate);
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
  }

  const problems = [
    ...new Set([...Object.values(fieldErrors), ...(preview.ok ? [] : preview.problems)]),
  ];
  const canSave = parsed.success && preview.ok && !pending;
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));
  const show = (field: string, key = field) => (touched[field] ? fieldErrors[key] : undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || !parsed.success || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setServerError(null);
    const payload: ExpensePayload = parsed.data;
    const url = expense
      ? `/api/groups/${groupId}/expenses/${expense.id}`
      : `/api/groups/${groupId}/expenses`;
    const response = await mutate(url, { method: expense ? 'PUT' : 'POST', body: payload });
    if (!response.ok) {
      submitting.current = false;
      setPending(false);
      setServerError(response.message);
      return;
    }
    // On success stay pending until the navigation replaces the page (no second submit).
    router.push(expensesHref(groupId));
    router.refresh();
  }

  const suggestionHint = (() => {
    if (suggestion.status === 'loading') return 'Buscando a taxa sugerida...';
    if (suggestion.status === 'ok') {
      return `Taxa sugerida (${suggestion.source}) em ${suggestion.date.split('-').reverse().join('/')}. Você pode ajustar.`;
    }
    if (editing && rateTouched) return 'Taxa salva na despesa. Você pode ajustar.';
    return 'Informe quanto vale 1 unidade da moeda da despesa na moeda-base.';
  })();

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-4"
    >
      <section className={SECTION}>
        <Input
          id="expense-description"
          label="Descrição"
          value={description}
          maxLength={120}
          autoComplete="off"
          error={show('description')}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => touch('description')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="expense-currency"
            label="Moeda"
            value={currency}
            options={currencies.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
            onChange={(e) => changeCurrency(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <Input
              id="expense-amount"
              label={`Valor (${currency})`}
              inputMode={units === 0 ? 'numeric' : 'decimal'}
              autoComplete="off"
              value={amount}
              placeholder={units === 0 ? '0' : '0,00'}
              error={amountParse.error ?? show('amount', 'originalAmountMinor')}
              announceError
              describedBy="expense-amount-preview"
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => touch('amount')}
            />
            <div id="expense-amount-preview" aria-live="polite" className="flex flex-col gap-0.5">
              {originalAmountMinor !== null && originalAmountMinor > 0n ? (
                <p className="text-amount font-bold" data-testid="amount-formatted">
                  {formatMoney(originalAmountMinor, currency)}
                </p>
              ) : null}
              {amountParse.ok && amountParse.thousandsHint ? (
                <p className="text-sm text-muted-foreground" data-testid="amount-hint">
                  Lido como {formatMoney(amountParse.minor, currency)} (o separador marca milhares).
                  Para centavos, digite 1,23.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {foreign ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
            <Input
              id="expense-rate"
              label={`Taxa de câmbio (1 ${currency} em ${baseCurrency})`}
              inputMode="decimal"
              autoComplete="off"
              value={rate}
              error={show('rate', 'exchangeRate')}
              onChange={(e) => {
                setRate(sanitizeRateInput(e.target.value));
                setRateTouched(true);
              }}
              onBlur={() => touch('rate')}
              describedBy="expense-rate-hint"
            />
            <p id="expense-rate-hint" className="text-sm text-muted-foreground">
              {suggestionHint}
            </p>
            {suggestion.status === 'error' ? (
              <Notice tone="warning" role="alert" title="Não foi possível buscar a taxa.">
                Informe a taxa manualmente ou tente buscar novamente.
              </Notice>
            ) : null}
            <Button
              variant="secondary"
              className="self-start"
              disabled={suggestion.status === 'loading'}
              onClick={() => {
                setRateTouched(false);
                setRetry((n) => n + 1);
              }}
            >
              {suggestion.status === 'error' ? 'Tentar buscar novamente' : 'Usar taxa sugerida'}
            </Button>
            {preview.ok ? (
              <p className="font-medium" data-testid="converted-total">
                ≈ {formatMoney(preview.amountMinor, baseCurrency)}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={SECTION}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="expense-paid-by"
            label="Pago por"
            value={paidBy}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
            onChange={(e) => setPaidBy(e.target.value)}
          />
          <Input
            id="expense-date"
            label="Data"
            type="date"
            value={date}
            error={show('date', 'occurredOn')}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => touch('date')}
          />
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-heading font-semibold">Rateio</h2>
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Tipo de rateio</legend>
          <div className="flex flex-wrap gap-2">
            {SPLIT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                  splitType === option.value
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-input bg-card',
                )}
              >
                <input
                  type="radio"
                  name="splitType"
                  value={option.value}
                  checked={splitType === option.value}
                  onChange={() => {
                    setSplitType(option.value);
                    setValues({});
                  }}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Participantes do rateio</legend>
          <ul className="flex flex-col gap-2">
            {members.map((member) => {
              const checked = selected.includes(member.id);
              const share = preview.ok
                ? preview.shares.find((s) => s.memberId === member.id)
                : undefined;
              return (
                <li
                  key={member.id}
                  className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <label className="inline-flex min-h-11 min-w-0 items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0"
                      checked={checked}
                      onChange={() => toggleMember(member.id)}
                    />
                    <Avatar name={member.name} size="sm" decorative />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{member.name}</span>
                  </label>
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    {checked && splitType !== 'EQUAL' ? (
                      <Input
                        id={`expense-share-${member.id}`}
                        label={
                          splitType === 'PERCENTAGE'
                            ? `Porcentagem de ${member.name} (%)`
                            : `Valor de ${member.name} (${currency})`
                        }
                        inputMode="decimal"
                        autoComplete="off"
                        className="w-36"
                        value={values[member.id] ?? ''}
                        placeholder={splitType === 'PERCENTAGE' ? '0' : units === 0 ? '0' : '0,00'}
                        announceError
                        error={
                          (splitType === 'PERCENTAGE'
                            ? parsePercent(values[member.id] ?? '')
                            : parseAmount(values[member.id] ?? '', units, currency)
                          ).error ?? undefined
                        }
                        onChange={(e) => {
                          const next = e.target.value;
                          setValues((current) => ({ ...current, [member.id]: next }));
                        }}
                      />
                    ) : null}
                    {checked && share ? (
                      <span className="text-sm" data-testid={`share-${member.id}`}>
                        {foreign ? (
                          <>
                            <span className="text-muted-foreground">
                              {formatMoney(share.originalAmountMinor, currency)} →{' '}
                            </span>
                          </>
                        ) : null}
                        <strong>{formatMoney(share.amountMinor, baseCurrency)}</strong>
                        {splitType === 'PERCENTAGE' ? (
                          <span className="text-muted-foreground">
                            {' '}
                            ({formatBasisPoints(parsePercentInput(values[member.id] ?? '') ?? 0n)})
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {problems.length === 0 ? (
          <Notice title="Rateio completo">
            {chosen.length} participante(s), total{' '}
            {preview.ok ? formatMoney(preview.amountMinor, baseCurrency) : ''}.
          </Notice>
        ) : (
          <div role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            <p className="font-medium">Para salvar:</p>
            <ul className="list-disc pl-5" data-testid="problems">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {serverError ? <Alert>{serverError}</Alert> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={expensesHref(groupId)} className={buttonVariants({ variant: 'secondary' })}>
          Cancelar
        </Link>
        <Button
          type="submit"
          size="lg"
          icon={<Save aria-hidden />}
          loading={pending}
          disabled={!canSave}
        >
          {pending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
