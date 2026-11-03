import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function GroupNotFound() {
  return (
    <EmptyState
      title="Grupo não encontrado"
      description="O grupo não existe ou você não tem acesso a ele."
      action={
        <Link href="/groups" className={buttonVariants({ variant: 'secondary' })}>
          Voltar aos grupos
        </Link>
      }
    />
  );
}
