import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeader({
    title,
    description,
    backHref,
    backLabel = 'Voltar',
    actions,
}: {
    title: string;
    description?: ReactNode;
    backHref?: string;
    backLabel?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1">
            {backHref ? (
                <Link
                    href={backHref}
                    className="inline-flex min-h-9 items-center gap-1 self-start text-sm font-semibold text-link underline-offset-2 hover:underline"
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    {backLabel}
                </Link>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="min-w-0 break-words text-title font-bold">{title}</h1>
                {actions}
            </div>
            {description ? <div className="text-muted-foreground">{description}</div> : null}
        </div>
    );
}
