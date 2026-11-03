import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export function ErrorState({
    title = 'Algo deu errado',
    message,
    action,
}: {
    title?: string;
    message: string;
    action?: ReactNode;
}) {
    return (
        <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded-lg border border-destructive bg-destructive-soft p-4 text-destructive-soft-foreground"
        >
            <h2 className="flex items-center gap-2 font-semibold">
                <CircleAlert aria-hidden className="size-5 shrink-0" />
                Erro: {title}
            </h2>
            <p>{message}</p>
            {action}
        </div>
    );
}
