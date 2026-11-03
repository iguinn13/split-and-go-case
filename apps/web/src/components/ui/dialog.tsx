'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Modal dialog on Radix: focus trap, Escape to close, focus restored to the trigger,
 * `aria-modal` and the title/description wiring come from the primitive. Always render a
 * DialogTitle (and a DialogDescription) inside DialogContent.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogContent({
    className,
    children,
    closeLabel = 'Fechar',
    ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { closeLabel?: string }) {
    return (
        <DialogPortal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/50" />
            <DialogPrimitive.Content
                className={cn(
                    'fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-xl border border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground shadow-pop sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-5',
                    className,
                )}
                {...props}
            >
                {children}
                <DialogPrimitive.Close
                    aria-label={closeLabel}
                    className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <X aria-hidden className="size-4" />
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
    return <div className={cn('flex flex-col gap-1.5 pr-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
            {...props}
        />
    );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title className={cn('text-heading font-semibold', className)} {...props} />
    );
}

export function DialogDescription({
    className,
    ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            className={cn('text-muted-foreground', className)}
            {...props}
        />
    );
}
