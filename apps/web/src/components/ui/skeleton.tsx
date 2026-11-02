import { cn } from '@/lib/utils';

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={cn('animate-pulse rounded bg-muted', className)}
    />
  );
}
