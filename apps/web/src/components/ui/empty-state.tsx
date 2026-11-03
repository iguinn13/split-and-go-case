import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
    title,
    description,
    action,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-card p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Inbox aria-hidden className="size-6" />
            </span>
            <h2 className="text-heading font-semibold">{title}</h2>
            {description ? <p className="text-muted-foreground">{description}</p> : null}
            {action}
        </div>
    );
}
