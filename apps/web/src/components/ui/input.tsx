import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? props.name ?? label;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-11 rounded-lg border bg-surface px-3 py-2 ${error ? 'border-danger-700' : 'border-line'} ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger-700">
          Erro: {error}
        </p>
      ) : null}
    </div>
  );
}
