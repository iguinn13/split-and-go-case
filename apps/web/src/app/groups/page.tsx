import Link from 'next/link';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import type { GroupSummary } from '@/lib/groups/types';

export const metadata = { title: 'Seus grupos | Split&Go' };

const createLink = (
  <Link
    href="/groups/new"
    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
  >
    Criar grupo
  </Link>
);

export default async function GroupsPage() {
  let groups: GroupSummary[];
  try {
    groups = await serverApi<GroupSummary[]>('/groups');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <ErrorState
        title="Não foi possível carregar seus grupos"
        message={errorMessage(error.code)}
        action={
          <Link href="/groups" className="font-semibold underline">
            Tentar novamente
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Seus grupos</h1>
        {groups.length > 0 ? createLink : null}
      </div>
      {groups.length === 0 ? (
        <EmptyState
          title="Você ainda não tem grupos"
          description="Crie um grupo para começar a dividir despesas com seus amigos."
          action={createLink}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="block rounded-card border border-line bg-surface p-4 shadow-sm hover:bg-brand-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="break-words text-lg font-semibold">{group.name}</h2>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      group.status === 'OPEN' ? 'bg-brand-50 text-brand-700' : 'bg-line text-ink'
                    }`}
                  >
                    {group.status === 'OPEN' ? 'Aberto' : 'Fechado'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Moeda: {group.baseCurrency} · {group.memberCount}{' '}
                  {group.memberCount === 1 ? 'participante' : 'participantes'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
