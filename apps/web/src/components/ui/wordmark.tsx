import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Wordmark({ className }: { className?: string }) {
    return (
        <span
            className={cn('inline-flex items-center gap-2 text-lg font-bold text-link', className)}
        >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ArrowLeftRight aria-hidden className="size-4" />
            </span>
            <span>Split&amp;Go</span>
        </span>
    );
}
