import type { InputHTMLAttributes } from 'react';
import { fieldAria } from '@/lib/ui/field-ids';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
    /** Explicit, whitespace-free id: it links the label, the hint and the error message. */
    id: string;
    label: string;
    /** Help text under the field, linked through aria-describedby. */
    hint?: string;
    error?: string;
    /** Extra description ids (for example a hint paragraph), merged with the error id. */
    describedBy?: string;
    /** Announce the error to screen readers as soon as it appears (live validation). */
    announceError?: boolean;
}

export const fieldClassName =
    'min-h-11 w-full rounded-lg border bg-card px-3 py-2 text-base text-card-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted sm:text-sm';

export function Input({
    label,
    hint,
    error,
    id,
    className,
    describedBy,
    announceError,
    ...props
}: InputProps) {
    const hintId = hint ? `${id}-hint` : undefined;
    const aria = fieldAria(id, Boolean(error), [hintId, describedBy].filter(Boolean).join(' '));

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-sm font-medium">
                {label}
            </label>
            <input
                id={id}
                aria-invalid={error ? true : undefined}
                aria-describedby={aria.describedBy}
                className={cn(
                    fieldClassName,
                    error ? 'border-destructive-soft-foreground' : 'border-input',
                    className,
                )}
                {...props}
            />
            {hint ? (
                <p id={hintId} className="text-sm text-muted-foreground">
                    {hint}
                </p>
            ) : null}
            {error ? (
                <p
                    id={aria.errorId}
                    role={announceError ? 'alert' : undefined}
                    className="text-sm font-medium text-destructive-soft-foreground"
                >
                    Erro: {error}
                </p>
            ) : null}
        </div>
    );
}
