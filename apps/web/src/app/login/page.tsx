import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Entrar | Split&Go' };

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Card title="Entrar">
        <AuthForm mode="login" />
      </Card>
    </div>
  );
}
