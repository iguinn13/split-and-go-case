import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/ui/wordmark';
import { getSessionToken } from '@/lib/auth/session';

export async function Header() {
    const signedIn = Boolean(await getSessionToken());

    return (
        <header className="border-b border-border bg-card pt-[env(safe-area-inset-top)]">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-page py-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
                <Link
                    href={signedIn ? '/groups' : '/'}
                    aria-label="Split&Go, página inicial"
                    className="rounded-md"
                >
                    <Wordmark />
                </Link>
                {signedIn ? (
                    <div className="flex flex-wrap items-center gap-1">
                        <nav aria-label="Principal">
                            <Link
                                href="/groups"
                                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-foreground hover:bg-accent"
                            >
                                Grupos
                            </Link>
                        </nav>
                        <form action="/api/auth/logout" method="post">
                            <Button type="submit" variant="secondary" icon={<LogOut aria-hidden />}>
                                <span className="max-[340px]:sr-only">Sair</span>
                            </Button>
                        </form>
                    </div>
                ) : null}
            </div>
        </header>
    );
}
