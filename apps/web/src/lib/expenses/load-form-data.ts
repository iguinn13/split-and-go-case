import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import type { Expense } from '@/lib/expenses/types';
import { isUuid } from '@/lib/http/guard';
import type { CurrencyOption, CurrentUser, Group } from '@/lib/groups/types';

export interface ExpenseFormData {
    group: Group;
    me: CurrentUser;
    currencies: CurrencyOption[];
    expense?: Expense;
}

/** Server-side loader shared by the create and edit pages. Throws ApiError for non-404 failures. */
export async function loadExpenseFormData(
    groupId: string,
    expenseId?: string,
): Promise<ExpenseFormData> {
    if (!isUuid(groupId) || (expenseId !== undefined && !isUuid(expenseId))) notFound();

    try {
        const [group, me, currencies, expense] = await Promise.all([
            serverApi<Group>(`/groups/${groupId}`),
            serverApi<CurrentUser>('/auth/me'),
            serverApi<CurrencyOption[]>('/currencies'),
            expenseId ? serverApi<Expense>(`/groups/${groupId}/expenses/${expenseId}`) : undefined,
        ]);

        return { group, me, currencies, ...(expense ? { expense } : {}) };
    } catch (error) {
        if (error instanceof ApiError && (error.statusCode === 404 || error.statusCode === 422)) {
            notFound();
        }

        throw error;
    }
}
