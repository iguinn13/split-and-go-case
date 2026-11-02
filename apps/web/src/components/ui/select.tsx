import type { SelectHTMLAttributes } from 'react';
import { fieldAria } from '@/lib/ui/field-ids';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  /** Explicit, whitespace-free id: it links the label and the error message. */
  id: string;
  label: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, id, options, className = '', ...props }: SelectProps) {
  const aria = fieldAria(id, Boolean(error));
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={aria.describedBy}
        className={`min-h-11 rounded-lg border bg-surface px-3 py-2 ${error ? 'border-danger-700' : 'border-line'} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={aria.errorId} className="text-sm text-danger-700">
          Erro: {error}
        </p>
      ) : null}
    </div>
  );
}
