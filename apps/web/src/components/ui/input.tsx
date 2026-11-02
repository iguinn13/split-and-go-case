import type { InputHTMLAttributes } from 'react';
import { fieldAria } from '@/lib/ui/field-ids';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Explicit, whitespace-free id: it links the label, the hint and the error message. */
  id: string;
  label: string;
  error?: string;
  /** Extra description ids (for example a hint paragraph), merged with the error id. */
  describedBy?: string;
  /** Announce the error to screen readers as soon as it appears (live validation). */
  announceError?: boolean;
}

export function Input({
  label,
  error,
  id,
  className = '',
  describedBy,
  announceError,
  ...props
}: InputProps) {
  const aria = fieldAria(id, Boolean(error), describedBy);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={aria.describedBy}
        className={`min-h-11 rounded-lg border bg-surface px-3 py-2 ${error ? 'border-danger-700' : 'border-line'} ${className}`}
        {...props}
      />
      {error ? (
        <p
          id={aria.errorId}
          role={announceError ? 'alert' : undefined}
          className="text-sm text-danger-700"
        >
          Erro: {error}
        </p>
      ) : null}
    </div>
  );
}
