'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
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
            {message ? <Alert>{message}</Alert> : null}
            {confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">Excluir esta despesa?</span>
                    <Button
                        variant="danger"
                        size="sm"
                        loading={pending}
                        disabled={pending}
                        onClick={() => void onDelete()}
                        aria-label={`Confirmar exclusão de ${description}`}
                    >
                        {pending ? 'Excluindo...' : 'Confirmar exclusão'}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() => setConfirming(false)}
                    >
                        Cancelar
                    </Button>
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`/groups/${groupId}/expenses/${expenseId}/edit`}
                        aria-label={`Editar ${description}`}
                        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                        Editar
                    </Link>
                    <Button
                        variant="secondary"
                        size="sm"
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
