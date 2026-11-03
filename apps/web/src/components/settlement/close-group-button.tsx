'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
import { mutate } from '@/lib/groups/client';
import { rememberEvent } from '@/lib/settlement/feedback';

/**
 * Owner-only "Fechar grupo" button with a modal confirmation (Radix dialog: focus trap, Escape,
 * focus restored to this button when the user cancels). After a successful close the button
 * disappears with the refreshed page, so focus is handed to SettlementFeedback instead.
 */
export function CloseGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const guard = useRef(false);
  const closedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    // Never dismiss while the request is in flight.
    if (busy) return;
    setOpen(next);
    if (!next) setMessage(null);
  }

  async function onConfirm() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage(null);
    setInfo(null);
    const response = await mutate(`/api/groups/${groupId}/close`, { method: 'POST' });
    if (response.ok || response.code === 'GROUP_CLOSED') {
      closedRef.current = true;
      if (!response.ok) setInfo('Este grupo já foi fechado. Atualizando a página...');
      rememberEvent(window.sessionStorage, { type: 'group-closed', groupId });
      // Stay pending until the refreshed page replaces this component.
      startTransition(() => router.refresh());
      return;
    }
    setMessage(response.message);
    guard.current = false;
    setBusy(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button icon={<Lock aria-hidden />}>Fechar grupo</Button>
        </DialogTrigger>
        <DialogContent
          onCloseAutoFocus={(event) => {
            // After closing for real, SettlementFeedback owns the focus.
            if (closedRef.current) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Fechar este grupo?</DialogTitle>
            <DialogDescription>
              Ao fechar, o grupo será congelado: despesas e participantes não poderão mais ser
              alterados e o plano de quitação ficará fixo. Esta ação é irreversível e o grupo não
              pode ser reaberto.
            </DialogDescription>
          </DialogHeader>
          {message ? <Alert>{message}</Alert> : null}
          {info ? <Notice>{info}</Notice> : null}
          <DialogFooter>
            <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void onConfirm()}>
              {busy ? 'Fechando...' : 'Fechar grupo definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
