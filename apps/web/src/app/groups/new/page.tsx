import Link from 'next/link';
import { CreateGroupForm } from '@/components/groups/create-group-form';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import type { CurrencyOption } from '@/lib/groups/types';

export const metadata = { title: 'Novo grupo | Split&Go' };

export default async function NewGroupPage() {
    let currencies: CurrencyOption[];

    try {
        currencies = await serverApi<CurrencyOption[]>('/currencies');
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;

        return (
            <ErrorState
                title="Não foi possível carregar as moedas"
                message={errorMessage(error.code)}
                action={
                    <Link href="/groups/new" className={buttonVariants({ variant: 'secondary' })}>
                        Tentar novamente
                    </Link>
                }
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Novo grupo"
                backHref="/groups"
                backLabel="Voltar aos grupos"
                description="Defina o nome, a moeda e quem participa. Você entra como dono."
            />
            <CreateGroupForm currencies={currencies} />
        </div>
    );
}
