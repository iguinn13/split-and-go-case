import { Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Informative or cautionary banner (never an error: errors use `Alert`/`ErrorState`, which carry
 * the "Erro:" prefix). The icon and the optional title keep the meaning from relying on colour.
 */
export function Notice({
    tone = 'info',
    title,
    children,
    role = 'status',
    className,
}: {
    tone?: 'info' | 'warning';
    title?: string;
    children?: ReactNode;
    role?: 'status' | 'alert';
    className?: string;
}) {
    const Icon = tone === 'warning' ? TriangleAlert : Info;

    return (
        <div
            role={role}
            className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                tone === 'warning'
                    ? 'border-warning-soft-foreground bg-warning-soft text-warning-soft-foreground'
                    : 'border-border bg-muted text-foreground',
                className,
            )}
        >
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 break-words">
                {title ? <p className="font-semibold">{title}</p> : null}
                {children ? <div>{children}</div> : null}
            </div>
        </div>
    );
}
