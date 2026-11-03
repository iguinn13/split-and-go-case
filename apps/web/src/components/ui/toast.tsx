'use client';

import { Toaster as Sonner, toast } from 'sonner';

/**
 * Toast host (sonner). Messages are announced through an aria-live region. Mount `<Toaster />`
 * once in the layout and call `toast.success('...')` / `toast.error('...')` from client code.
 * Toasts disappear on their own, so never use them as the only place for an error that blocks
 * the user: keep inline `role="alert"` messages for forms.
 */
export function Toaster() {
    return (
        <Sonner
            position="bottom-center"
            closeButton
            containerAriaLabel="Notificações"
            toastOptions={{
                classNames: {
                    toast: '!rounded-lg !border !border-border !bg-card !text-card-foreground !shadow-pop !font-sans',
                    description: '!text-muted-foreground',
                },
            }}
        />
    );
}

export { toast };
