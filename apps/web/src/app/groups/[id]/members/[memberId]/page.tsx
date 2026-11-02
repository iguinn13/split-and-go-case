import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BalanceAmount } from '@/components/balances/balance-amount';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { balancesHref } from '@/lib/balances/status';
import type { Statement } from '@/lib/balances/types';
import { conversionLine, formatDate } from '@/lib/expenses/format';
import { isUuid } from '@/lib/http/guard';
import { formatMoney } from '@/lib/money/format-money';

export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  // Malformed ids never reach the API.
  if (!isUuid(id) || !isUuid(memberId)) notFound();

  let statement: Statement;
  try {
    statement = await serverApi<Statement>(`/groups/${id}/members/${memberId}/statement`);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // 404 covers unknown member and groups the user is not part of.
    if (error.statusCode === 404 || error.statusCode === 422) notFound();
    return (
      <ErrorState
        title="Não foi possível carregar o extrato"
        message={errorMessage(error.code)}
        action={
          <Link href={`/groups/${id}/members/${memberId}`} className="font-semibold underline">
            Tentar novamente
          </Link>
        }
      />
    );
  }

  const { currency, member, totals, lines } = statement;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={balancesHref(id)} className="text-sm font-semibold text-brand-700 underline">
          Voltar aos saldos
        </Link>
        <h1 className="mt-1 break-words text-2xl font-bold">Extrato de {member.name}</h1>
      </div>

      <section
        aria-label="Resumo do extrato"
        className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Saldo final</span>
          <BalanceAmount netMinor={totals.netMinor} currency={currency} />
        </div>
        <p className="text-sm text-muted-foreground">
          Pagou {formatMoney(totals.paidMinor, currency)} · Parte{' '}
          {formatMoney(totals.owedMinor, currency)}
        </p>
      </section>

      {lines.length === 0 ? (
        <EmptyState
          title="Nenhuma despesa neste extrato"
          description="Este participante ainda não pagou nem deve em nenhuma despesa."
        />
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Linhas do extrato">
          {lines.map((line) => (
            <li
              key={line.expenseId}
              className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
            >
              <div>
                <p className="break-words font-medium">{line.description}</p>
                <p className="text-sm text-muted-foreground">{formatDate(line.occurredOn)}</p>
                {line.original ? (
                  <p className="text-sm text-muted-foreground">
                    {conversionLine(line.original, line.amountMinor, currency)}
                  </p>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
                <Cell label="Pago" value={formatMoney(line.paidMinor, currency)} />
                <Cell label="Devido" value={formatMoney(line.owedMinor, currency)} />
                <Cell label="Resultado" value={formatMoney(line.netMinor, currency)} />
                <Cell
                  label="Saldo acumulado"
                  value={formatMoney(line.runningBalanceMinor, currency)}
                />
              </dl>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
