import { Plus } from 'lucide-react';
import Link from 'next/link';
import { GroupCard } from '@/components/groups/group-card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import type { GroupSummary } from '@/lib/groups/types';

export const metadata = { title: 'Seus grupos | Split&Go' };

function CreateLink() {
  return (
    <Link href="/groups/new" className={buttonVariants()}>
      <Plus aria-hidden />
      Criar grupo
    </Link>
  );
}

export default async function GroupsPage() {
  let groups: GroupSummary[];
  try {
    groups = await serverApi<GroupSummary[]>('/groups');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Seus grupos" />
        <ErrorState
          title="Não foi possível carregar seus grupos"
          message={errorMessage(error.code)}
          action={
            <Link href="/groups" className={buttonVariants({ variant: 'secondary' })}>
              Tentar novamente
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Seus grupos"
        description={
          groups.length > 0
            ? `${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}`
            : undefined
        }
        actions={groups.length > 0 ? <CreateLink /> : undefined}
      />
      {groups.length === 0 ? (
        <EmptyState
          title="Você ainda não tem grupos"
          description="Crie um grupo para começar a dividir despesas com seus amigos."
          action={<CreateLink />}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Seus grupos">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupCard group={group} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
