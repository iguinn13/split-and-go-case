import Link from 'next/link';
import { ExpenseForm } from '@/components/expenses/expense-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ApiError, errorMessage } from '@/lib/api';
import { expensesHref } from '@/lib/expenses/format';
import { loadExpenseFormData } from '@/lib/expenses/load-form-data';

/** Shared body of the "new expense" and "edit expense" pages (states: error, blocked, form). */
export async function ExpenseFormPage({
  groupId,
  expenseId,
}: {
  groupId: string;
  expenseId?: string;
}) {
  let data;
  try {
    data = await loadExpenseFormData(groupId, expenseId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <ErrorState
        title="Não foi possível carregar o formulário"
        message={errorMessage(error.code)}
        action={
          <Link href={expensesHref(groupId)} className="font-semibold underline">
            Voltar às despesas
          </Link>
        }
      />
    );
  }
  const { group, me, currencies, expense } = data;
  const back = (
    <Link href={expensesHref(group.id)} className="font-semibold underline">
      Voltar às despesas
    </Link>
  );

  let blocked: { title: string; description: string } | null = null;
  if (group.status === 'CLOSED') {
    blocked = {
      title: 'Grupo fechado',
      description: 'Este grupo está fechado: não é possível criar, editar ou excluir despesas.',
    };
  } else if (group.members.length < 2) {
    blocked = {
      title: 'Participantes insuficientes',
      description: 'Adicione pelo menos 2 participantes para lançar despesas.',
    };
  } else if (expense && expense.createdByUserId !== me.id && group.ownerId !== me.id) {
    blocked = {
      title: 'Sem permissão',
      description: 'Somente quem criou a despesa ou o dono do grupo pode editá-la.',
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {back}
        <h1 className="mt-1 text-2xl font-bold">{expense ? 'Editar despesa' : 'Nova despesa'}</h1>
        <p className="text-sm text-muted">
          {group.name} · Moeda-base: {group.baseCurrency}
        </p>
      </div>
      {blocked ? (
        <EmptyState title={blocked.title} description={blocked.description} action={back} />
      ) : (
        <ExpenseForm
          groupId={group.id}
          baseCurrency={group.baseCurrency}
          members={group.members}
          currencies={currencies}
          currentMemberId={group.members.find((m) => m.userId === me.id)?.id}
          {...(expense ? { expense } : {})}
        />
      )}
    </div>
  );
}
