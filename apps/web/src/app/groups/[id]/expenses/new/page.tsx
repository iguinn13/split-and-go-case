import { ExpenseFormPage } from '@/components/expenses/expense-form-page';

export const metadata = { title: 'Nova despesa | Split&Go' };

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExpenseFormPage groupId={id} />;
}
