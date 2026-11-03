import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth/session';

export default async function HomePage() {
    const hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);

    redirect(hasSession ? '/groups' : '/login');
}
