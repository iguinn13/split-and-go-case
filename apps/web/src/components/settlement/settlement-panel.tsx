import { ArrowRight, CircleCheck, Clock, Lock } from 'lucide-react';
import Link from 'next/link';
import { CloseGroupButton } from '@/components/settlement/close-group-button';
import { PayTransferButton } from '@/components/settlement/pay-transfer-button';
import { SettlementFeedback } from '@/components/settlement/settlement-feedback';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Notice } from '@/components/ui/notice';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import {
  paidCount,
  paidSummary,
  totalMovedLabel,
  transferCountLabel,
  transferSentence,
  transferSentenceParts,
  transferStatusView,
} from '@/lib/settlement/format';
import type { SettlementPlan } from '@/lib/settlement/types';

export async function SettlementPanel({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  let plan: SettlementPlan;
  try {
    plan = await serverApi<SettlementPlan>(`/groups/${groupId}/settlement-plan`);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <ErrorState
        title="Não foi possível carregar a quitação"
        message={errorMessage(error.code)}
        action={
          <Link
            href={`/groups/${groupId}?tab=settlement`}
            className={buttonVariants({ variant: 'secondary' })}
          >
            Tentar novamente
          </Link>
        }
      />
    );
  }

  const closed = plan.status === 'CLOSED';
  const hasTransfers = plan.transfers.length > 0;
  const paid = paidCount(plan.transfers);
  const summary = closed && hasTransfers ? paidSummary(plan.transfers) : null;

  return (
    <div className="flex flex-col gap-4">
      <SettlementFeedback groupId={groupId} summary={summary}>
        {hasTransfers ? (
          <section
            aria-label="Resumo da quitação"
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-heading font-semibold">{transferCountLabel(plan.transferCount)}</p>
              <Badge variant={closed ? 'neutral' : 'success'}>
                {closed ? <Lock aria-hidden /> : null}
                {closed ? 'Plano fixo' : 'Plano em aberto'}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {totalMovedLabel(plan.totalMovedMinor, plan.currency)}
            </p>
            {summary ? (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <p className="font-semibold" data-testid="paid-summary">
                  {summary}
                </p>
                <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((paid / plan.transfers.length) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
              <CircleCheck aria-hidden className="size-6" />
            </span>
            <p className="text-heading font-semibold">Tudo certo! Ninguém deve nada.</p>
          </section>
        )}
      </SettlementFeedback>

      {hasTransfers ? (
        <ul className="flex flex-col gap-2" aria-label="Plano de quitação">
          {plan.transfers.map((transfer, index) => {
            const parts = transferSentenceParts(transfer, plan.currency);
            const status = transfer.status ? transferStatusView(transfer.status) : null;
            const StatusIcon = transfer.status === 'PAID' ? CircleCheck : Clock;
            return (
              <li
                key={transfer.id ?? index}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="flex shrink-0 items-center gap-1" aria-hidden>
                    <Avatar name={parts.from} size="sm" decorative />
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <Avatar name={parts.to} size="sm" decorative />
                  </span>
                  <p className="min-w-0 flex-1 break-words">
                    <strong>{parts.from}</strong> paga <strong>{parts.amount}</strong> para{' '}
                    <strong>{parts.to}</strong>
                  </p>
                </div>
                {closed && transfer.id && status ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <Badge variant={status.variant}>
                      <StatusIcon aria-hidden />
                      {status.label}
                    </Badge>
                    {transfer.status === 'PENDING' ? (
                      <PayTransferButton
                        groupId={groupId}
                        transferId={transfer.id}
                        label={transferSentence(transfer, plan.currency)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!closed && isOwner ? (
        <div className="flex flex-col items-start gap-2">
          <CloseGroupButton groupId={groupId} />
          <p className="text-sm text-muted-foreground">
            Fechar congela o grupo e fixa este plano. Não é possível reabrir.
          </p>
        </div>
      ) : null}
      {!closed && !isOwner ? <Notice>Somente o dono do grupo pode fechá-lo.</Notice> : null}
    </div>
  );
}
