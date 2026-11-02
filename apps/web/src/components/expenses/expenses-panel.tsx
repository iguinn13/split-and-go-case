import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { ExpenseActions } from '@/components/expenses/expense-actions';
import { Avatar } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Notice } from '@/components/ui/notice';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { conversionLine, expensesHref, formatDate } from '@/lib/expenses/format';
import type { Expense, Page } from '@/lib/expenses/types';
import type { Group } from '@/lib/groups/types';
import { formatMoney } from '@/lib/money/format-money';

interface Props {
  group: Group;
  userId: string;
  page: number;
}

export async function ExpensesPanel({ group, userId, page }: Props) {
  const closed = group.status === 'CLOSED';
  const isOwner = group.ownerId === userId;
  const canCreate = !closed && group.members.length >= 2;
  const newHref = `/groups/${group.id}/expenses/new`;

  let data: Page<Expense>;
  try {
    data = await serverApi<Page<Expense>>(`/groups/${group.id}/expenses`, {
      query: { page, pageSize: 20 },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <ErrorState
        title="Não foi possível carregar as despesas"
        message={errorMessage(error.code)}
        action={
          <Link
            href={expensesHref(group.id, page)}
            className={buttonVariants({ variant: 'secondary' })}
          >
            Tentar novamente
          </Link>
        }
      />
    );
  }

  const names = new Map(group.members.map((m) => [m.id, m.name]));
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  const newButton = canCreate ? (
    <Link href={newHref} className={buttonVariants({ size: 'lg' })}>
      <Plus aria-hidden />
      Nova despesa
    </Link>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {data.items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? 'despesa' : 'despesas'}
          </p>
          {newButton}
        </div>
      ) : null}
      {!closed && group.members.length < 2 ? (
        <Notice>Adicione pelo menos 2 participantes para lançar despesas.</Notice>
      ) : null}

      {data.items.length === 0 && data.total > 0 ? (
        <EmptyState
          title="Esta página não existe"
          description="As despesas mudaram desde que você abriu esta página."
          action={
            <Link
              href={expensesHref(group.id, lastPage)}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Ir para a última página
            </Link>
          }
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="Nenhuma despesa lançada"
          description={
            closed
              ? 'Este grupo está fechado e não tem despesas.'
              : 'Lance a primeira despesa para começar a dividir.'
          }
          action={newButton}
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Despesas do grupo">
          {data.items.map((expense) => {
            const foreign = expense.currency !== group.baseCurrency;
            const canModify = !closed && (expense.createdByUserId === userId || isOwner);
            const payer = names.get(expense.paidByMemberId);
            return (
              <li
                key={expense.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={payer ?? '?'} decorative />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{expense.description}</p>
                    <p className="break-words text-sm text-muted-foreground">
                      Pago por {payer ?? 'participante removido'} em{' '}
                      {formatDate(expense.occurredOn)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-lg font-bold">
                    {formatMoney(expense.amountMinor, group.baseCurrency)}
                  </p>
                </div>
                {foreign ? (
                  <p className="break-words rounded-lg bg-muted px-2 py-1 text-sm text-muted-foreground">
                    {conversionLine(
                      {
                        currency: expense.currency,
                        amountMinor: expense.originalAmountMinor,
                        exchangeRate: expense.exchangeRate,
                      },
                      expense.amountMinor,
                      group.baseCurrency,
                    )}
                  </p>
                ) : null}
                {canModify ? (
                  <ExpenseActions
                    groupId={group.id}
                    expenseId={expense.id}
                    description={expense.description}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {lastPage > 1 ? (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link
              href={expensesHref(group.id, page - 1)}
              className={buttonVariants({ variant: 'secondary' })}
            >
              <ChevronLeft aria-hidden />
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            Página {page} de {lastPage}
          </span>
          {page < lastPage ? (
            <Link
              href={expensesHref(group.id, page + 1)}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Próxima
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
