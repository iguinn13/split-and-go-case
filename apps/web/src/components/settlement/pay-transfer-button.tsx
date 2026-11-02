'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { mutate } from '@/lib/groups/client';

export function PayTransferButton({
  groupId,
  transferId,
  label,
}: {
  groupId: string;
  transferId: string;
  /** Plain sentence of the transfer, used as the accessible name. */
  label: string;
}) {
  const router = useRouter();
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onPay() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage(null);
    const response = await mutate(`/api/groups/${groupId}/transfers/${transferId}/pay`, {
      method: 'PATCH',
    });
    if (response.ok) {
      // Stay pending until the refreshed page replaces this button with the "Paga" status.
      startTransition(() => router.refresh());
      return;
    }
    setMessage(response.message);
    guard.current = false;
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => void onPay()}
        aria-label={`Marcar como paga: ${label}`}
      >
        {busy ? 'Marcando...' : 'Marcar como paga'}
      </Button>
      {message ? (
        <p role="alert" className="text-sm text-danger-700">
          Erro: {message}
        </p>
      ) : null}
    </div>
  );
}
