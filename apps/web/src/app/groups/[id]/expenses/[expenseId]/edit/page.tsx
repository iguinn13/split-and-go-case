import { ExpenseFormPage } from '@/components/expenses/expense-form-page';

export const metadata = { title: 'Editar despesa | Split&Go' };

export default async function EditExpensePage({
    params,
}: {
    params: Promise<{ id: string; expenseId: string }>;
}) {
    const { id, expenseId } = await params;

    return <ExpenseFormPage groupId={id} expenseId={expenseId} />;
}
