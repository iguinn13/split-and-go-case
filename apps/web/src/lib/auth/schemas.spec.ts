import { describe, expect, it } from 'vitest';
import { fieldErrors, loginSchema, registerSchema } from './schemas';

describe('registerSchema', () => {
  it('accepts valid data and trims the name', () => {
    const parsed = registerSchema.parse({
      name: '  Ana ',
      email: 'ana@example.com',
      password: '12345678',
    });
    expect(parsed.name).toBe('Ana');
  });

  it('reports pt-BR messages per field', () => {
    const result = registerSchema.safeParse({ name: 'A', email: 'x', password: '123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        name: 'O nome deve ter pelo menos 2 caracteres.',
        email: 'Informe um e-mail válido.',
        password: 'A senha deve ter pelo menos 8 caracteres.',
      });
    }
  });

  it('rejects passwords longer than 72 characters', () => {
    const result = registerSchema.safeParse({
      name: 'Ana',
      email: 'ana@example.com',
      password: 'a'.repeat(73),
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires email and password', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        email: 'Informe seu e-mail.',
        password: 'Informe sua senha.',
      });
    }
  });

  it('does not enforce the minimum length on login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});
