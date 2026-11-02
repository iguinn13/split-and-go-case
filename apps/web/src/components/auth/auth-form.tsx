'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fieldErrors, loginSchema, registerSchema } from '@/lib/auth/schemas';

type Mode = 'login' | 'register';
type Values = { name: string; email: string; password: string };

const CONFIG = {
  login: {
    schema: loginSchema,
    endpoint: '/api/auth/login',
    submit: 'Entrar',
    submitting: 'Entrando...',
    altText: 'Ainda não tem conta?',
    altLabel: 'Cadastre-se',
    altHref: '/register',
  },
  register: {
    schema: registerSchema,
    endpoint: '/api/auth/register',
    submit: 'Criar conta',
    submitting: 'Criando conta...',
    altText: 'Já tem conta?',
    altLabel: 'Entrar',
    altHref: '/login',
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const config = CONFIG[mode];
  const router = useRouter();
  const [values, setValues] = useState<Values>({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const result = config.schema.safeParse(values);
  const errors = result.success ? {} : fieldErrors(result.error);
  const visible = (field: keyof Values) => (touched[field] ? errors[field] : undefined);

  const bind = (field: keyof Values) => ({
    name: field,
    value: values[field],
    error: visible(field),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setServerError(null);
      setValues((current) => ({ ...current, [field]: event.target.value }));
    },
    onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!result.success) {
      setTouched({ name: true, email: true, password: true });
      return;
    }
    setPending(true);
    setServerError(null);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setServerError(body?.message ?? 'Erro inesperado. Tente novamente em instantes.');
        setPending(false);
        return;
      }
      router.replace('/groups');
      router.refresh();
    } catch {
      setServerError('Não foi possível conectar ao servidor. Tente novamente.');
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="flex flex-col gap-4"
      aria-busy={pending}
    >
      {serverError ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-700 bg-danger-50 px-3 py-2 text-sm text-danger-700"
        >
          Erro: {serverError}
        </div>
      ) : null}
      {mode === 'register' ? (
        <Input label="Nome" type="text" autoComplete="name" {...bind('name')} />
      ) : null}
      <Input
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        {...bind('email')}
      />
      <Input
        label="Senha"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        {...bind('password')}
      />
      {mode === 'register' ? (
        <p className="-mt-2 text-sm text-muted">Use de 8 a 72 caracteres.</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? config.submitting : config.submit}
      </Button>
      <p className="text-center text-sm text-muted">
        {config.altText}{' '}
        <Link href={config.altHref} className="font-semibold text-brand-700 underline">
          {config.altLabel}
        </Link>
      </p>
    </form>
  );
}
