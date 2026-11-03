import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({
    title,
    as: Heading = 'h2',
    children,
    className,
}: {
    title?: string;
    as?: 'h1' | 'h2';
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn('rounded-lg border border-border bg-card p-4 shadow-card', className)}
        >
            {title ? <Heading className="mb-2 text-heading font-semibold">{title}</Heading> : null}
            {children}
        </section>
    );
}
