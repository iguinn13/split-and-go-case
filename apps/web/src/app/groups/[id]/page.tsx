import { Coins, HandCoins, Lock, Receipt, Scale, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BalancesPanel } from '@/components/balances/balances-panel';
import { ExpensesPanel } from '@/components/expenses/expenses-panel';
import { MembersPanel } from '@/components/groups/members-panel';
import { SettlementPanel } from '@/components/settlement/settlement-panel';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { NavTabs } from '@/components/ui/nav-tabs';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import type { BalancesView } from '@/lib/balances/types';
import { formatMoney } from '@/lib/money/format-money';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { pageQuerySchema } from '@/lib/expenses/schemas';
import type { CurrentUser, Group } from '@/lib/groups/types';

const TABS = [
  { id: 'expenses', label: 'Despesas', icon: <Receipt aria-hidden /> },
  { id: 'balances', label: 'Saldos', icon: <Scale aria-hidden /> },
  { id: 'members', label: 'Participantes', icon: <Users aria-hidden /> },
  { id: 'settlement', label: 'Quitação', icon: <HandCoins aria-hidden /> },
] as const;

type TabId = (typeof TABS)[number]['id'];

function parseTab(value: string | string[] | undefined): TabId {
  const tab = TABS.find((t) => t.id === value);
  return tab ? tab.id : 'members';
}

/** URL of the group on a given tab, so a retry lands where the user was. */
function groupHref(id: string, tab: TabId, page: number): string {
  const path = `/groups/${encodeURIComponent(id)}?tab=${tab}`;
  return tab === 'expenses' && page > 1 ? `${path}&page=${page}` : path;
}

/**
 * Sum of what members paid = total of all expenses in the base currency. It comes from the
 * balances endpoint (persisted values); the summary simply omits the total if it fails.
 */
async function loadTotal(groupId: string): Promise<number | null> {
  try {
    const data = await serverApi<BalancesView>(`/groups/${groupId}/balances`);
    return data.balances.reduce((sum, b) => sum + b.paidMinor, 0);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return null;
  }
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
  let total: number | null;
  try {
    [group, me, total] = await Promise.all([
      serverApi<Group>(`/groups/${encodeURIComponent(id)}`),
      serverApi<CurrentUser>('/auth/me'),
      loadTotal(id),
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
          <Link
            href={groupHref(id, tab, page)}
            className={buttonVariants({ variant: 'secondary' })}
          >
            Tentar novamente
          </Link>
        }
      />
    );
  }

  const closed = group.status === 'CLOSED';
  const base = `/groups/${group.id}`;

  const memberCount = `${group.members.length} ${group.members.length === 1 ? 'participante' : 'participantes'}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={group.name} backHref="/groups" backLabel="Voltar aos grupos" />

      <section
        aria-label="Resumo do grupo"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
      >
        <div className="flex items-start gap-3">
          <Avatar name={group.name} size="lg" decorative />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={closed ? 'neutral' : 'success'}>
                {closed ? <Lock aria-hidden /> : null}
                {closed ? 'Fechado' : 'Aberto'}
              </Badge>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Users aria-hidden className="size-4" />
                {memberCount}
              </span>
            </div>
            {group.description ? (
              <p className="break-words text-muted-foreground">{group.description}</p>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-sm text-muted-foreground">
              <Coins aria-hidden className="size-4" />
              Moeda-base
            </dt>
            <dd className="font-semibold">{group.baseCurrency}</dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-sm text-muted-foreground">
              <Wallet aria-hidden className="size-4" />
              Total de despesas
            </dt>
            <dd className="break-words text-amount font-bold" data-testid="group-total">
              {total === null ? '—' : formatMoney(total, group.baseCurrency)}
            </dd>
          </div>
        </dl>
      </section>

      {closed ? (
        <Notice title="Grupo fechado">Os dados estão disponíveis somente para consulta.</Notice>
      ) : null}

      <NavTabs
        label="Seções do grupo"
        activeId={tab}
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          href: `${base}?tab=${t.id}`,
          icon: t.icon,
        }))}
      />

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
