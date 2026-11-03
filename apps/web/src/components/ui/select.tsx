import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';
import { fieldAria } from '@/lib/ui/field-ids';
import { cn } from '@/lib/utils';
import { fieldClassName } from './input';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
    /** Explicit, whitespace-free id: it links the label and the error message. */
    id: string;
    label: string;
    error?: string;
    options: { value: string; label: string }[];
}

/**
 * Styled native `<select>`: the browser provides keyboard typeahead, the mobile picker and screen
 * reader semantics for free, which a custom listbox would have to re-implement.
 */
export function Select({ label, error, id, options, className, ...props }: SelectProps) {
    const aria = fieldAria(id, Boolean(error));

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-sm font-medium">
                {label}
            </label>
            <div className="relative">
                <select
                    id={id}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={aria.describedBy}
                    className={cn(
                        fieldClassName,
                        'appearance-none pr-10',
                        error ? 'border-destructive-soft-foreground' : 'border-input',
                        className,
                    )}
                    {...props}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
            </div>
            {error ? (
                <p
                    id={aria.errorId}
                    className="text-sm font-medium text-destructive-soft-foreground"
                >
                    Erro: {error}
                </p>
            ) : null}
        </div>
    );
}
