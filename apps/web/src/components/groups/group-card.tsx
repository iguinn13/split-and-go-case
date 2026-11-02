import { ChevronRight, Coins, Lock, Users } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { GroupSummary } from '@/lib/groups/types';

/** Summary card of one group in the list: name, base currency, participants and status. */
export function GroupCard({ group }: { group: GroupSummary }) {
  const open = group.status === 'OPEN';
  const count = `${group.memberCount} ${group.memberCount === 1 ? 'participante' : 'participantes'}`;
  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Avatar name={group.name} size="lg" decorative />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="min-w-0 break-words text-heading font-semibold">{group.name}</h2>
          <Badge variant={open ? 'success' : 'neutral'}>
            {open ? null : <Lock aria-hidden />}
            {open ? 'Aberto' : 'Fechado'}
          </Badge>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Coins aria-hidden className="size-4" />
            Moeda: {group.baseCurrency}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users aria-hidden className="size-4" />
            {count}
          </span>
        </p>
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
