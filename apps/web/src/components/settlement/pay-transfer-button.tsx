'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { mutate } from '@/lib/groups/client';
import { rememberEvent } from '@/lib/settlement/feedback';

export function PayTransferButton({
  groupId,
  transferId,
  label,
}: {
  groupId: string;
  transferId: string;
  /** Plain sentence of the transfer, used as the accessible name and in the announcement. */
  label: string;
}) {
  const router = useRouter();
  const guard = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
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
      // The refreshed page replaces this button with the "Paga" status; SettlementFeedback then
      // moves focus to the summary and announces the result.
      rememberEvent(window.sessionStorage, { type: 'transfer-paid', groupId, sentence: label });
      startTransition(() => router.refresh());
      return;
    }
    setMessage(response.message);
    guard.current = false;
    setBusy(false);
    // A disabled button drops focus: give it back so keyboard users can retry.
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        ref={buttonRef}
        variant="secondary"
        size="sm"
        loading={busy}
        icon={<Check aria-hidden />}
        onClick={() => void onPay()}
        aria-label={`Marcar como paga: ${label}`}
      >
        {busy ? 'Marcando...' : 'Marcar como paga'}
      </Button>
      {message ? <Alert>{message}</Alert> : null}
    </div>
  );
}
