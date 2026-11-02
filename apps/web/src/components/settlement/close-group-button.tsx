'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { mutate } from '@/lib/groups/client';

/**
 * Owner-only "Fechar grupo" button with a modal confirmation. The native `<dialog>` opened
 * with `showModal()` provides the focus trap, Escape to cancel and focus restoration.
 */
export function CloseGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guard = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function onConfirm() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage(null);
    const response = await mutate(`/api/groups/${groupId}/close`, { method: 'POST' });
    if (response.ok || response.code === 'GROUP_CLOSED') {
      if (!response.ok) setMessage('Este grupo já foi fechado. Atualizando a página...');
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
      <Button onClick={() => setOpen(true)}>Fechar grupo</Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="close-group-title"
        aria-describedby="close-group-description"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          // Keep Tab/Shift+Tab cycling inside the dialog instead of leaving the page.
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'),
          );
          const first = items[0];
          const last = items[items.length - 1];
          if (!first || !last) {
            event.preventDefault();
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-surface p-5 text-ink shadow-lg backdrop:bg-black/50"
      >
        <h2 id="close-group-title" className="text-lg font-semibold">
          Fechar este grupo?
        </h2>
        <p id="close-group-description" className="mt-2 text-sm">
          Ao fechar, o grupo será congelado: despesas e participantes não poderão mais ser alterados
          e o plano de quitação ficará fixo. Esta ação é irreversível e o grupo não pode ser
          reaberto.
        </p>
        {message ? (
          <p role="alert" className="mt-3 text-sm text-danger-700">
            Erro: {message}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" autoFocus disabled={busy} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? 'Fechando...' : 'Fechar grupo definitivamente'}
          </Button>
        </div>
      </dialog>
    </>
  );
}
