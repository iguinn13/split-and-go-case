import type { ReactNode } from 'react';

/** Centered entry card shared by the login and register screens. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-2 sm:pt-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-title font-bold">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        {children}
      </div>
    </div>
  );
}
