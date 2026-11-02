import Link from 'next/link';
import { CloseGroupButton } from '@/components/settlement/close-group-button';
import { PayTransferButton } from '@/components/settlement/pay-transfer-button';
import { ErrorState } from '@/components/ui/error-state';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import {
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
          <Link href={`/groups/${groupId}?tab=settlement`} className="font-semibold underline">
            Tentar novamente
          </Link>
        }
      />
    );
  }

  const closed = plan.status === 'CLOSED';

  return (
    <div className="flex flex-col gap-4">
      {plan.transfers.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-4 font-semibold">
          <span aria-hidden="true">✓ </span>
          Tudo certo! Ninguém deve nada.
        </p>
      ) : (
        <>
          <div className="rounded-card border border-line bg-surface p-4">
            <p className="font-semibold">{transferCountLabel(plan.transferCount)}</p>
            <p className="text-sm text-muted-foreground">
              {totalMovedLabel(plan.totalMovedMinor, plan.currency)}
            </p>
            {closed ? (
              <p className="mt-1 text-sm font-semibold" aria-live="polite">
                {paidSummary(plan.transfers)}
              </p>
            ) : null}
          </div>
          <ul className="flex flex-col gap-2" aria-label="Plano de quitação">
            {plan.transfers.map((transfer, index) => {
              const parts = transferSentenceParts(transfer, plan.currency);
              const status = transfer.status ? transferStatusView(transfer.status) : null;
              return (
                <li
                  key={transfer.id ?? index}
                  className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="min-w-0 break-words">
                    <strong>{parts.from}</strong> paga <strong>{parts.amount}</strong> para{' '}
                    <strong>{parts.to}</strong>
                  </p>
                  {closed && transfer.id && status ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`text-sm font-semibold ${status.className}`}>
                        <span aria-hidden="true">{status.icon} </span>
                        {status.label}
                      </span>
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
        </>
      )}

      {!closed && isOwner ? (
        <div className="flex flex-col items-start gap-1">
          <CloseGroupButton groupId={groupId} />
          <p className="text-sm text-muted-foreground">
            Fechar congela o grupo e fixa este plano. Não é possível reabrir.
          </p>
        </div>
      ) : null}
      {!closed && !isOwner ? (
        <p className="text-sm text-muted-foreground">Somente o dono do grupo pode fechá-lo.</p>
      ) : null}
    </div>
  );
}
