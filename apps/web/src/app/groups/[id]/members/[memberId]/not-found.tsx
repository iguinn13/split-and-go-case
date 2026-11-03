import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function MemberNotFound() {
  return (
    <EmptyState
      title="Participante não encontrado"
      description="O participante não existe neste grupo ou você não tem acesso a ele."
      action={
        <Link href="/groups" className={buttonVariants({ variant: 'secondary' })}>
          Voltar aos grupos
        </Link>
      }
    />
  );
}
