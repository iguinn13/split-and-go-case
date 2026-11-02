'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
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
      setMessage(response.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-700 bg-danger-50 px-3 py-2 text-sm text-danger-700"
        >
          Erro: {message}
        </div>
      ) : null}

      <ul className="flex flex-col gap-2" aria-label="Participantes do grupo">
        {members.map((member) => {
          const isGroupOwner = member.userId === ownerId;
          return (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">
                  {member.name}
                  {isGroupOwner ? (
                    <span className="ml-2 rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      Dono
                    </span>
                  ) : null}
                </p>
                <p className="break-all text-sm text-muted-foreground">
                  {member.email ?? 'Sem e-mail'}
                </p>
              </div>
              {canEdit && !isGroupOwner ? (
                <Button
                  variant="secondary"
                  disabled={removingId !== null}
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
          className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
        >
          <h3 className="font-semibold">Adicionar participante</h3>
          <Input
            id="member-name"
            label="Nome"
            value={name}
            error={submitted ? errors['name'] : undefined}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            maxLength={60}
          />
          <Input
            id="member-email"
            label="E-mail (opcional)"
            type="email"
            inputMode="email"
            value={email}
            error={submitted ? errors['email'] : undefined}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
          <Button type="submit" disabled={adding} className="self-start">
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
