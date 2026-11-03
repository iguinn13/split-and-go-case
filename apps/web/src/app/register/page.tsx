import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Cadastro | Split&Go' };

export default function RegisterPage() {
    return (
        <AuthCard
            title="Criar conta"
            subtitle="Leva menos de um minuto. Depois é só criar um grupo e dividir."
        >
            <AuthForm mode="register" />
        </AuthCard>
    );
}
