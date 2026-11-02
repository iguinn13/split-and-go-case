import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getSessionToken } from '@/lib/auth/session';

export async function Header() {
  const signedIn = Boolean(await getSessionToken());
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-page py-3">
        <Link href={signedIn ? '/groups' : '/'} className="text-lg font-bold text-brand-700">
          Split&amp;Go
        </Link>
        {signedIn ? (
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="secondary">
              Sair
            </Button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
