import { z } from 'zod';

// Mirrors the API rules (apps/api/src/modules/auth/auth.schemas.ts) with pt-BR messages.
const email = z
    .string()
    .trim()
    .min(1, 'Informe seu e-mail.')
    .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
    .pipe(z.email('Informe um e-mail válido.'));

export const registerSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'O nome deve ter pelo menos 2 caracteres.')
        .max(80, 'O nome deve ter no máximo 80 caracteres.'),
    email,
    password: z
        .string()
        .min(8, 'A senha deve ter pelo menos 8 caracteres.')
        .max(72, 'A senha deve ter no máximo 72 caracteres.'),
});

export const loginSchema = z.object({
    email,
    password: z
        .string()
        .min(1, 'Informe sua senha.')
        .max(72, 'A senha deve ter no máximo 72 caracteres.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
    const result: Record<string, string> = {};

    for (const issue of error.issues) {
        const key = String(issue.path[0] ?? '');

        if (key && !(key in result)) result[key] = issue.message;
    }

    return result;
}
