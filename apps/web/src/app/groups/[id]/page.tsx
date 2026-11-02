import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BalancesPanel } from '@/components/balances/balances-panel';
import { ExpensesPanel } from '@/components/expenses/expenses-panel';
import { MembersPanel } from '@/components/groups/members-panel';
import { SettlementPanel } from '@/components/settlement/settlement-panel';
import { ErrorState } from '@/components/ui/error-state';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { pageQuerySchema } from '@/lib/expenses/schemas';
import type { CurrentUser, Group } from '@/lib/groups/types';

const TABS = [
  { id: 'expenses', label: 'Despesas' },
  { id: 'balances', label: 'Saldos' },
  { id: 'members', label: 'Participantes' },
  { id: 'settlement', label: 'Quitação' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function parseTab(value: string | string[] | undefined): TabId {
  const tab = TABS.find((t) => t.id === value);
  return tab ? tab.id : 'members';
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[]; page?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = parseTab(query.tab);
  const page = pageQuerySchema.parse({ page: query.page }).page;

  let group: Group;
  let me: CurrentUser;
  try {
    [group, me] = await Promise.all([
      serverApi<Group>(`/groups/${encodeURIComponent(id)}`),
      serverApi<CurrentUser>('/auth/me'),
    ]);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // 404 also covers groups the user is not part of (RN-GRP-10); malformed ids are a 422.
    if (error.statusCode === 404 || error.statusCode === 422) notFound();
    return (
      <ErrorState
        title="Não foi possível carregar o grupo"
        message={errorMessage(error.code)}
        action={
          <Link href={`/groups/${encodeURIComponent(id)}`} className="font-semibold underline">
            Tentar novamente
          </Link>
        }
      />
    );
  }

  const closed = group.status === 'CLOSED';
  const base = `/groups/${group.id}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/groups" className="text-sm font-semibold text-brand-700 underline">
          Voltar aos grupos
        </Link>
        <h1 className="mt-1 break-words text-2xl font-bold">{group.name}</h1>
        {group.description ? <p className="text-muted">{group.description}</p> : null}
        <p className="mt-1 text-sm text-muted">
          Moeda-base: {group.baseCurrency} · {closed ? 'Fechado' : 'Aberto'}
        </p>
      </div>

      {closed ? (
        <div
          role="status"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium"
        >
          Aviso: este grupo está fechado. Os dados estão disponíveis somente para consulta.
        </div>
      ) : null}

      <nav aria-label="Seções do grupo" className="-mx-1 overflow-x-auto">
        <ul className="flex gap-1 border-b border-line px-1">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={`${base}?tab=${t.id}`}
                aria-current={t.id === tab ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold ${
                  t.id === tab
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'members' ? (
        <MembersPanel
          groupId={group.id}
          ownerId={group.ownerId}
          members={group.members}
          isOwner={group.ownerId === me.id}
          closed={closed}
        />
      ) : tab === 'expenses' ? (
        <ExpensesPanel group={group} userId={me.id} page={page} />
      ) : tab === 'balances' ? (
        <BalancesPanel groupId={group.id} />
      ) : (
        <SettlementPanel groupId={group.id} isOwner={group.ownerId === me.id} />
      )}
    </div>
  );
}
