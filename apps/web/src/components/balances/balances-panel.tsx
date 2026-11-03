import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { BalanceAmount } from '@/components/balances/balance-amount';
import { Avatar } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Notice } from '@/components/ui/notice';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { balanceStatus, magnitude, statementHref } from '@/lib/balances/status';
import type { BalancesView } from '@/lib/balances/types';
import { formatMoney } from '@/lib/money/format-money';

export async function BalancesPanel({
  groupId,
  currentMemberId,
}: {
  groupId: string;
  /** Participant linked to the signed-in user, to highlight "Você recebe / Você deve". */
  currentMemberId?: string;
}) {
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
          <Link
            href={`/groups/${groupId}?tab=balances`}
            className={buttonVariants({ variant: 'secondary' })}
          >
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
  const mine = data.balances.find((b) => b.memberId === currentMemberId);
  const mineStatus = mine ? balanceStatus(mine.netMinor) : null;

  return (
    <div className="flex flex-col gap-4">
      {noActivity ? (
        <Notice>Ainda não há despesas lançadas: todos os participantes estão quitados.</Notice>
      ) : null}

      {mine && mineStatus ? (
        <section
          aria-label="Seu saldo"
          data-testid="my-balance"
          className={`flex flex-col gap-1 rounded-xl border border-l-4 border-border bg-card p-4 shadow-card ${mineStatus.borderClass}`}
        >
          <p className={`text-heading font-bold ${mineStatus.textClass}`}>
            <span aria-hidden="true">{mineStatus.icon} </span>
            {mineStatus.selfHeadline}
            {mineStatus.kind === 'settled' ? null : (
              <> {formatMoney(magnitude(mine.netMinor), data.currency)}</>
            )}
          </p>
          <Link
            href={statementHref(groupId, mine.memberId)}
            className="inline-flex min-h-9 items-center gap-1 self-start text-sm font-semibold text-link underline"
          >
            Ver meu extrato
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </section>
      ) : null}

      <ul className="flex flex-col gap-2" aria-label="Saldos dos participantes">
        {data.balances.map((b) => {
          const status = balanceStatus(b.netMinor);
          return (
            <li key={b.memberId}>
              <Link
                href={statementHref(groupId, b.memberId)}
                className={`flex min-h-16 flex-col gap-2 rounded-xl border border-l-4 border-border bg-card p-3 shadow-card hover:bg-accent ${status.borderClass}`}
              >
                <span className="flex items-center gap-3">
                  <Avatar name={b.name} decorative />
                  <span className="min-w-0 flex-1 break-words font-semibold">{b.name}</span>
                  <BalanceAmount netMinor={b.netMinor} currency={data.currency} />
                </span>
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    Pagou {formatMoney(b.paidMinor, data.currency)} · Parte{' '}
                    {formatMoney(b.owedMinor, data.currency)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-link underline">
                    Ver extrato
                    <ChevronRight aria-hidden className="size-4" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
