import { redirect } from 'next/navigation';
import { ExpiredSessionForm } from '@/components/auth/expired-session-form';
import { ErrorState } from '@/components/ui/error-state';
import { ApiError, apiFetch, errorMessage } from '@/lib/api';
import { getSessionToken } from '@/lib/auth/session';

export const metadata = { title: 'Sessão expirada | Split&Go' };

/**
 * Landing page for rejected tokens. Opening it never changes state by itself: the cookie is
 * only cleared (through a POST) when the API really rejects the current token, so an
 * external link cannot sign a valid session out.
 */
export default async function SessionExpiredPage() {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  try {
    await apiFetch('/auth/me', { token });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      return (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Sessão expirada</h1>
          <ExpiredSessionForm />
        </div>
      );
    }
    if (error instanceof ApiError) {
      return (
        <ErrorState
          title="Não foi possível verificar sua sessão"
          message={errorMessage(error.code)}
        />
      );
    }
    throw error;
  }
  redirect('/groups');
}
