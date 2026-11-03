import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth/session';

/** The login screen is the entry point: signed-in users go straight to their groups. */
export default async function HomePage() {
    const hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);

    redirect(hasSession ? '/groups' : '/login');
}
