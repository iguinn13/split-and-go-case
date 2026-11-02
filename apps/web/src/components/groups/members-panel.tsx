'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Crown, Trash2, UserPlus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mutate } from '@/lib/groups/client';
import { buildAddMemberSchema, pathErrors } from '@/lib/groups/schemas';
import type { Member } from '@/lib/groups/types';

interface Props {
  groupId: string;
  ownerId: string;
  members: Member[];
  /** The signed-in user owns the group. */
  isOwner: boolean;
  closed: boolean;
}

export function MembersPanel({ groupId, ownerId, members, isOwner, closed }: Props) {
  const router = useRouter();
  const canEdit = isOwner && !closed;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, email: false });
  const touch = (field: 'name' | 'email') => setTouched((c) => ({ ...c, [field]: true }));
  // Live validation: show a field's error once it was left (blur) or after a submit attempt.
  const fieldError = (field: 'name' | 'email') =>
    submitted || touched[field] ? errors[field] : undefined;

  const result = buildAddMemberSchema(members).safeParse({ name, email });
  const errors = result.success ? {} : pathErrors(result.error);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    setSubmitted(true);
    setMessage(null);
    if (!result.success) return;
    setAdding(true);
    const response = await mutate(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: result.data,
    });
    setAdding(false);
    if (!response.ok) {
      setMessage(response.message);
      return;
    }
    setName('');
    setEmail('');
    setSubmitted(false);
    setTouched({ name: false, email: false });
    router.refresh();
  }

  async function onRemove(member: Member) {
    if (removingId) return;
    setRemovingId(member.id);
    setMessage(null);
    const response = await mutate(`/api/groups/${groupId}/members/${member.id}`, {
      method: 'DELETE',
    });
    setRemovingId(null);
    if (!response.ok) {
      setMessage(
        response.code === 'MEMBER_HAS_EXPENSES'
          ? `${member.name} não pode ser removido porque já participa de despesas. Edite ou exclua essas despesas e tente de novo.`
          : response.message,
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert>{message}</Alert> : null}

      <ul className="flex flex-col gap-2" aria-label="Participantes do grupo">
        {members.map((member) => {
          const isGroupOwner = member.userId === ownerId;
          return (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
            >
              <Avatar name={member.name} decorative />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                  <span className="min-w-0 break-words">{member.name}</span>
                  {isGroupOwner ? (
                    <Badge variant="success">
                      <Crown aria-hidden />
                      Dono
                    </Badge>
                  ) : null}
                </p>
                <p className="break-all text-sm text-muted-foreground">
                  {member.email ?? 'Sem e-mail'}
                </p>
              </div>
              {canEdit && !isGroupOwner ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Trash2 aria-hidden />}
                  disabled={removingId !== null}
                  loading={removingId === member.id}
                  onClick={() => void onRemove(member)}
                  aria-label={`Remover ${member.name}`}
                >
                  {removingId === member.id ? 'Removendo...' : 'Remover'}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canEdit ? (
        <form
          onSubmit={(event) => void onAdd(event)}
          noValidate
          aria-busy={adding}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
        >
          <h2 className="text-heading font-semibold">Adicionar participante</h2>
          <Input
            id="member-name"
            label="Nome"
            value={name}
            error={fieldError('name')}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => touch('name')}
            autoComplete="off"
            maxLength={60}
          />
          <Input
            id="member-email"
            label="E-mail (opcional)"
            type="email"
            inputMode="email"
            value={email}
            error={fieldError('email')}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => touch('email')}
            autoComplete="off"
          />
          <Button
            type="submit"
            loading={adding}
            icon={<UserPlus aria-hidden />}
            className="self-start"
          >
            {adding ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </form>
      ) : null}

      {!isOwner && !closed ? (
        <p className="text-sm text-muted-foreground">
          Somente o dono do grupo pode gerenciar participantes.
        </p>
      ) : null}
    </div>
  );
}
