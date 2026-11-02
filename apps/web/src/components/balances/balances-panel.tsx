import Link from 'next/link';
import { BalanceAmount } from '@/components/balances/balance-amount';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { balanceStatus, statementHref } from '@/lib/balances/status';
import type { BalancesView } from '@/lib/balances/types';
import { formatMoney } from '@/lib/money/format-money';

export async function BalancesPanel({ groupId }: { groupId: string }) {
  let data: BalancesView;
  try {
    data = await serverApi<BalancesView>(`/groups/${groupId}/balances`);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <ErrorState
        title="Não foi possível carregar os saldos"
        message={errorMessage(error.code)}
        action={
          <Link href={`/groups/${groupId}?tab=balances`} className="font-semibold underline">
            Tentar novamente
          </Link>
        }
      />
    );
  }

  if (data.balances.length === 0) {
    return (
      <EmptyState
        title="Nenhum participante"
        description="Adicione participantes e lance despesas para ver os saldos."
      />
    );
  }

  const noActivity = data.balances.every((b) => b.paidMinor === 0 && b.owedMinor === 0);

  return (
    <div className="flex flex-col gap-3">
      {noActivity ? (
        <p className="text-sm text-muted">
          Ainda não há despesas lançadas: todos os participantes estão quitados.
        </p>
      ) : null}
      <ul className="flex flex-col gap-2" aria-label="Saldos dos participantes">
        {data.balances.map((b) => {
          const status = balanceStatus(b.netMinor);
          return (
            <li key={b.memberId}>
              <Link
                href={statementHref(groupId, b.memberId)}
                className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border border-l-4 border-line bg-surface p-3 hover:bg-brand-50 ${status.borderClass}`}
              >
                <span className="min-w-0">
                  <span className="block break-words font-medium">{b.name}</span>
                  <span className="block text-sm text-muted">
                    Pagou {formatMoney(b.paidMinor, data.currency)} · Parte{' '}
                    {formatMoney(b.owedMinor, data.currency)}
                  </span>
                  <span className="block text-sm font-semibold text-brand-700 underline">
                    Ver extrato
                  </span>
                </span>
                <BalanceAmount netMinor={b.netMinor} currency={data.currency} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
