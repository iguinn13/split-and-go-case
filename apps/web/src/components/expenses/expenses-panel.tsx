import Link from 'next/link';
import { ExpenseActions } from '@/components/expenses/expense-actions';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { expensesHref, formatDate } from '@/lib/expenses/format';
import { displayRate } from '@/lib/expenses/money-input';
import type { Expense, Page } from '@/lib/expenses/types';
import type { Group } from '@/lib/groups/types';
import { formatMoney } from '@/lib/money/format-money';

interface Props {
  group: Group;
  userId: string;
  page: number;
}

const linkButton =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold';

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
          <Link href={expensesHref(group.id, page)} className="font-semibold underline">
            Tentar novamente
          </Link>
        }
      />
    );
  }

  const names = new Map(group.members.map((m) => [m.id, m.name]));
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  const newButton = canCreate ? (
    <Link href={newHref} className={`${linkButton} bg-brand-600 text-white hover:bg-brand-700`}>
      Nova despesa
    </Link>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {newButton ? <div className="flex">{newButton}</div> : null}
      {!closed && group.members.length < 2 ? (
        <p className="text-sm text-muted">
          Adicione pelo menos 2 participantes para lançar despesas.
        </p>
      ) : null}

      {data.items.length === 0 ? (
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
            return (
              <li
                key={expense.id}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{expense.description}</p>
                    <p className="text-sm text-muted">
                      Pago por {names.get(expense.paidByMemberId) ?? 'participante removido'} em{' '}
                      {formatDate(expense.occurredOn)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-semibold">
                    {formatMoney(expense.amountMinor, group.baseCurrency)}
                  </p>
                </div>
                {foreign ? (
                  <p className="text-sm text-muted">
                    {formatMoney(expense.originalAmountMinor, expense.currency)} · taxa{' '}
                    {displayRate(expense.exchangeRate)} ·{' '}
                    {formatMoney(expense.amountMinor, group.baseCurrency)}
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
              className={`${linkButton} border border-line bg-surface`}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">
            Página {page} de {lastPage}
          </span>
          {page < lastPage ? (
            <Link
              href={expensesHref(group.id, page + 1)}
              className={`${linkButton} border border-line bg-surface`}
            >
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
