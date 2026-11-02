import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-card p-4 shadow-card', className)}>
      {title ? <h2 className="mb-2 text-heading font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}
