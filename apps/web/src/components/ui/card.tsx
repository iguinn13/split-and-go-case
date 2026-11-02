import type { ReactNode } from 'react';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-sm">
      {title ? <h2 className="mb-2 text-lg font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}
