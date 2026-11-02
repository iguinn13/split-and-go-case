import type { ReactNode } from 'react';

export function ErrorState({
  title = 'Algo deu errado',
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-card border border-danger-700 bg-danger-50 p-4 text-danger-700"
    >
      <h2 className="font-semibold">Erro: {title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}
