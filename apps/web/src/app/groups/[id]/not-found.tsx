import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';

export default function GroupNotFound() {
  return (
    <EmptyState
      title="Grupo não encontrado"
      description="O grupo não existe ou você não tem acesso a ele."
      action={
        <Link href="/groups" className="font-semibold text-brand-700 underline">
          Voltar aos grupos
        </Link>
      }
    />
  );
}
