import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Cadastro | Split&Go' };

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Card title="Criar conta" as="h1">
        <AuthForm mode="register" />
      </Card>
    </div>
  );
}
