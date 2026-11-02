import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Inline error banner announced to screen readers. The "Erro:" prefix keeps it from being color-only. */
export function Alert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-destructive bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground',
        className,
      )}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 break-words">
        <span className="font-semibold">Erro:</span> {children}
      </p>
    </div>
  );
}
