import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Entrar | Split&Go' };

export default function LoginPage() {
  return (
    <AuthCard title="Entrar" subtitle="Acesse seus grupos e acompanhe quem deve a quem.">
      <AuthForm mode="login" />
    </AuthCard>
  );
}
