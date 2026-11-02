'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { mutate } from '@/lib/groups/client';

interface Props {
  groupId: string;
  expenseId: string;
  description: string;
}

/** Edit link plus a two-step delete (confirmation before the request). */
export function ExpenseActions({ groupId, expenseId, description }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onDelete() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    const response = await mutate(`/api/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    });
    setPending(false);
    if (!response.ok) {
      setMessage(response.message);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {message ? (
        <p role="alert" className="text-sm text-danger-700">
          Erro: {message}
        </p>
      ) : null}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Excluir esta despesa?</span>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => void onDelete()}
            aria-label={`Confirmar exclusão de ${description}`}
          >
            {pending ? 'Excluindo...' : 'Confirmar exclusão'}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/groups/${groupId}/expenses/${expenseId}/edit`}
            aria-label={`Editar ${description}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-brand-50"
          >
            Editar
          </Link>
          <Button
            variant="secondary"
            onClick={() => setConfirming(true)}
            aria-label={`Excluir ${description}`}
          >
            Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
