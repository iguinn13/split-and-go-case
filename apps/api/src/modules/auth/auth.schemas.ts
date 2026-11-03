import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerSchema = z.object({
    name: z.string().trim().min(2).max(80),
    email,
    password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
    email,
    password: z.string().min(1).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface UserView {
    id: string;
    name: string;
    email: string;
}
