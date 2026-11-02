/** Client-side helper: calls a Route Handler and normalizes the pt-BR error message. */
export type MutationResult<T> =
  { ok: true; data: T } | { ok: false; message: string; code?: string };

export async function mutate<T>(
  input: string,
  init: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<MutationResult<T>> {
  try {
    const response = await fetch(input, {
      method: init.method,
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (response.status === 401) {
      window.location.assign('/api/auth/expired');
      return { ok: false, message: 'Sua sessão expirou. Entre novamente.' };
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        code?: string;
      } | null;
      return {
        ok: false,
        code: body?.code,
        message: body?.message ?? 'Erro inesperado. Tente novamente em instantes.',
      };
    }
    const data: unknown = response.status === 204 ? undefined : await response.json();
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, message: 'Não foi possível conectar ao servidor. Tente novamente.' };
  }
}
